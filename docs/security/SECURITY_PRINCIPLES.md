# BoardForge — Security Principles

---

## 1. Executive Security Baseline

La seguridad en BoardForge se fundamenta en los principios de **Security by Design**, **Zero Trust** y **Defense in Depth (Defensa en Profundidad)**. Toda decisión técnica y funcional debe alinearse con:

* **OWASP Top 10** (Vulnerabilidades en aplicaciones web).
* **OWASP ASVS (Application Security Verification Standard) Nivel 2** como estándar objetivo para todas las APIs y servicios.
* **Reglamento General de Protección de Datos (RGPD / GDPR)** para privacidad y tratamiento de datos de usuarios y clientes de talleres.

---

## 2. Authentication & Session Management

### 2.1. Mecanismo de Autenticación
- **Tokens Criptográficos Seguros:** Autenticación basada en tokens JWT de corta duración (*Access Tokens*, vida máxima 15 minutos) acompañados de *Refresh Tokens* opacos y rotativos almacenados en base de datos.
- **Almacenamiento de Tokens en Cliente:** Los *Access Tokens* y *Refresh Tokens* se transmiten exclusivamente mediante **Cookies `HttpOnly`, `Secure` y `SameSite=Strict`** (o `Lax` según sea necesario para flujos OAuth) para mitigar de raíz el robo de sesiones mediante ataques XSS.
- **Hashing de Contraseñas:** Uso obligatorio de **Argon2id** (o bcrypt con factor de coste $\ge 12$ como alternativa estándar) con sal (*salt*) criptográfica única por usuario. Prohibido el uso de algoritmos obsoletos (MD5, SHA1, SHA256 simple).
- **Multi-Factor Authentication (MFA / 2FA):** Soporte nativo para TOTP (RFC 6238) obligatorio para roles administrativos y altamente recomendado para todos los técnicos.

### 2.2. Gestión de Sesiones y Revocación
- **Revocación Inmediata:** Capacidad de invalidar sesiones individuales o globales (cambio de contraseña, detección de anomalías, cierre de sesión en todos los dispositivos).
- **Detección de Reutilización de Refresh Tokens:** Si un *refresh token* ya utilizado es presentado nuevamente, se invalidan inmediatamente todas las sesiones activas del usuario por sospecha de compromiso de credenciales.

---

## 3. Authorization & Multi-Tenancy Isolation

### 3.1. Role-Based Access Control (RBAC) + Attribute-Based Access Control (ABAC)
BoardForge implementa un modelo jerárquico de control de acceso por organización:

```text
Global Admin
    └── Organization Owner
            ├── Workshop Manager (Lead Tech)
            │       ├── Senior Technician
            │       └── Junior Technician
            └── Viewer / Guest (Read-Only)
```

- **Principio de Mínimo Privilegio (*Least Privilege*):** Los usuarios sólo disponen de los permisos explícitamente requeridos para su función.
- **Verificación Contextual en Cada Petición:** Toda operación en la capa de aplicación valida:
  1. Que el usuario esté autenticado.
  2. Que pertenezca a la organización propietaria del recurso (`organization_id`).
  3. Que posea el permiso granular requerido (ej. `board:write`, `measurement:approve`, `user:manage`).

### 3.2. Aislamiento Estricto Multi-Tenant (Prevención de IDOR)
- **Mitigación de Insecure Direct Object References (IDOR):**
  - Prohibido el uso de IDs secuenciales incrementales (`1, 2, 3...`) expuestos en las APIs públicas. Uso obligatorio de identificadores universalmente únicos aleatorios (**UUID v4** o **ULID**).
  - Todas las consultas a nivel de repositorio y base de datos deben incluir obligatoriamente el filtro de pertenencia a la organización:
    $$\text{WHERE resource\_id} = :id \text{ AND organization\_id} = :current\_org\_id$$
  - Implementación recomendada de **Row-Level Security (RLS)** a nivel de base de datos como segunda barrera defensiva.

---

## 4. API Security, Rate Limiting & Input Validation

### 4.1. Validación Estricta de Entradas (Input Validation)
- Validación de esquema en todas las entradas mediante esquemas fuertemente tipados (*Fail-Safe Schema Validation* tipo Zod/Joi/DTOs de clase con validadores).
- Política de lista blanca (*Allow-list*): Cualquier parámetro no definido explícitamente en el esquema se descarta automáticamente.

### 4.2. Rate Limiting & Throttling
- **Límites Globales y Específicos:**
  - Endpoints de autenticación (`/login`, `/register`, `/forgot-password`): Límite estricto (ej. máximo 5 intentos por minuto por IP/usuario) con bloqueo temporal para mitigar ataques de fuerza bruta.
  - Endpoints de búsqueda y lectura: Límites razonables para prevenir *scraping* masivo de catálogos y esquemáticos.
  - Endpoints de subida de archivos: Límites de frecuencia y concurrencia por organización.

### 4.3. Prevención de Vulnerabilidades Web Clásicas
- **Cross-Site Scripting (XSS):**
  - Sanitización de cualquier entrada de texto enriquecido (notas de reparación, guías técnicas) mediante librerías auditadas (ej. DOMPurify).
  - Encabezados de seguridad HTTP obligatorios:
    - `Content-Security-Policy (CSP)` estricto (deshabilitando `unsafe-inline` y `unsafe-eval`).
    - `X-Content-Type-Options: nosniff`.
    - `X-Frame-Options: DENY` o `SAMEORIGIN`.
- **Cross-Site Request Forgery (CSRF):**
  - Uso de cookies `SameSite=Strict/Lax` y validación de tokens Anti-CSRF sincronizados para operaciones mutables (`POST`, `PUT`, `PATCH`, `DELETE`).
- **SQL Injection:**
  - Uso exclusivo de consultas parametrizadas y ORM/Query Builders seguros. Prohibida terminantemente la concatenación manual de strings en sentencias SQL.
- **Server-Side Request Forgery (SSRF):**
  - Si el sistema descarga hojas de datos o recursos externos vía URL, se utiliza una lista blanca estricta de protocolos (`https` únicamente), bloqueo de rangos de IP privadas/internas (`127.0.0.1`, `10.0.0.0/8`, `192.168.0.0/16`, `169.254.169.254` de metadatos cloud) y resolución DNS segura.
- **Path Traversal / LFI:**
  - Los nombres de archivo subidos por los usuarios nunca se utilizan directamente en el sistema de archivos. Se genera un identificador UUID interno y se valida que la ruta canónica no escape del directorio asignado.

---

## 5. Secure File Upload & Storage Pipeline

La gestión de esquemáticos (PDF), archivos BoardView (`.brd`, `.cad`, `.fz`) e imágenes es un vector crítico de ataque:

```text
[Cliente: Archivo]
        │
        ▼
[1. Validación MIME Real (Magic Bytes) + Tamaño Máximo]
        │
        ▼
[2. Escaneo Antivirus / Antimalware Asíncrono (ClamAV/VirusTotal)]
        │
        ▼
[3. Sanitización / Transformación a Formato Seguro Canónico]
        │
        ▼
[4. Almacenamiento Cifrado en Repositorio Privado (S3 / Blob Storage)]
        │
        ▼
[5. Acceso mediante URLs Firmadas Temporales (Presigned URLs)]
```

### 5.1. Reglas de Subida de Archivos:
1. **Validación de Tipo por Contenido:** Prohibido fiarse de la extensión del archivo o del encabezado `Content-Type` enviado por el cliente. Validación obligatoria de los *Magic Bytes* del fichero.
2. **Límites de Tamaño:** Restricciones duras de tamaño máximo (ej. PDFs hasta 50MB, BoardViews hasta 30MB, Imágenes hasta 10MB).
3. **Aislamiento en Almacenamiento:** Los archivos se almacenan fuera de la raíz web ejecutable, en *buckets* de almacenamiento de objetos privados con cifrado en reposo (AES-256 / SSE-S3).
4. **Descarga y Visualización Segura:** Los archivos se sirven exclusivamente mediante URLs pre-firmadas con expiración corta (ej. 15 minutos) y cabeceras `Content-Disposition: attachment` para descargas o tipos MIME estrictos para renderizado en visores seguros aislados (*sandboxed iframes* o canvas).

---

## 6. Secrets Management & Environment Security

- **Prohibido el Almacenamiento de Secretos en Código:** Ningún secreto, API key, certificado o credencial de base de datos se commitea en el repositorio Git (detección preventiva mediante hooks de pre-commit y herramientas de escaneo como `gitleaks` / `trufflehog`).
- **Gestión Centralizada de Variables de Entorno:** Uso de gestores de secretos dedicados en entornos de producción (HashiCorp Vault, AWS Secrets Manager, GCP Secret Manager o Doppler).
- **Principio de Mínimo Privilegio en Infraestructura:** Las credenciales de la base de datos de la aplicación no tienen permisos de administración de base de datos (`SUPERUSER` / `DROP DATABASE`).

---

## 7. Audit Logging, Traceability & Monitoring

- **Registro de Auditoría Inmutable (*Security Audit Log*):**
  - Eventos obligatorios de auditar: inicios de sesión (exitosos y fallidos), cambios de contraseña, activación de 2FA, modificaciones de roles/permisos, exportación o borrado masivo de datos, subida/borrado de esquemáticos propietarios.
  - Estructura del log: `Timestamp (UTC)`, `Actor ID`, `Organization ID`, `Event Type`, `Resource ID`, `Source IP`, `User Agent`, `Outcome (Success/Failure)`.
- **Protección de Datos Sensibles en Logs (Log Sanitization):** Filtro automático para evitar que contraseñas, tokens de autenticación, números de tarjetas de crédito o datos personales sensibles se escriban en los logs de aplicación.

---

## 8. Privacy & GDPR Compliance

- **Minimización de Datos:** Recopilar únicamente los datos personales estrictamente necesarios para la prestación del servicio.
- **Derecho al Olvido y Supresión (Right to Erasure):** Flujo documentado para anonimizar o eliminar de forma segura los datos personales a solicitud del usuario, preservando la integridad técnica de las reparaciones históricas mediante desvinculación de identidad.
- **Portabilidad de Datos:** Mecanismo para que las organizaciones exporten sus mediciones, historiales y procedimientos en formatos estructurados estándar (JSON/CSV).
- **Cifrado en Tránsito y Reposo:** Cifrado obligatorio en tránsito mediante **TLS 1.3** (o TLS 1.2 mínimo con suites de cifrado seguras) y cifrado en reposo para bases de datos y volúmenes de almacenamiento.

---

## 9. Open Decisions

| ID | Área | Descripción de la Decisión Abierta | Opciones Consideradas |
|---|---|---|---|
| `OD-SEC-001` | Proveedor / Motor de Auth | Elección del motor de identidad y autenticación. | (A) Solución propia en el monolito (Argon2id + JWT HttpOnly); (B) Proveedor de Identidad dedicado / Open Source (Keycloak, Ory Kratos, Authentik); (C) Auth-as-a-Service gestionado (Auth0, Supabase Auth, Clerk). |
| `OD-SEC-002` | Escaneo de Archivos | Estrategia de escaneo antimalware en la subida de esquemáticos y archivos binarios. | (A) Worker asíncrono con ClamAV en contenedor; (B) Integración vía API con servicios cloud de escaneo de objetos; (C) Validación en sandbox de parseo aislado. |
| `OD-SEC-003` | Estrategia Multi-Tenant DB | Nivel de aislamiento en base de datos para organizaciones. | (A) Base de datos compartida con discriminador `organization_id` + Row-Level Security (RLS); (B) Schema por organización (PostgreSQL Multi-Schema); (C) Base de datos dedicada por organización grande. |
