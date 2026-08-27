import { ICompositeBoardRepository } from "../../domain/catalog/repositories/ICompositeBoardRepository.js";
import { GetCompositeBoardHandler } from "./queries/GetCompositeBoardHandler.js";
import { CompositeBoardDto } from "./dtos/CompositeBoardDto.js";
import { EntityNotFoundError } from "../../interfaces/http/errors/HttpErrors.js";
import { CreateDeviceDto } from "../../interfaces/http/dtos/catalog.dto.js";

export interface DeviceDto {
  id: string;
  name: string;
  boardNumber: string;
  boardId: string;
  organizationId?: string;
}

export class CatalogFacade {
  private readonly getCompositeBoardHandler: GetCompositeBoardHandler;
  private readonly devices: Map<string, DeviceDto> = new Map();

  constructor(private readonly boardRepository: ICompositeBoardRepository) {
    this.getCompositeBoardHandler = new GetCompositeBoardHandler(boardRepository);

    // Default seeded device
    this.devices.set("DEV_IPHONE13", {
      id: "DEV_IPHONE13",
      name: "iPhone 13",
      boardNumber: "820-02106",
      boardId: "BRD_820_02106",
    });
  }

  public async listDevices(organizationId?: string): Promise<{ items: DeviceDto[] }> {
    const items: DeviceDto[] = [];
    for (const dev of this.devices.values()) {
      if (!dev.organizationId || !organizationId || dev.organizationId === organizationId) {
        items.push(dev);
      }
    }
    return { items };
  }

  public async getDeviceById(id: string, organizationId?: string): Promise<DeviceDto> {
    const device = this.devices.get(id);
    if (!device) {
      throw new EntityNotFoundError(`Device '${id}' not found.`);
    }
    if (device.organizationId && organizationId && device.organizationId !== organizationId) {
      throw new EntityNotFoundError(`Device '${id}' not found.`);
    }
    return device;
  }

  public async createDevice(dto: CreateDeviceDto, organizationId?: string): Promise<DeviceDto> {
    const device: DeviceDto = {
      id: dto.id,
      name: dto.name,
      boardNumber: dto.boardNumber,
      boardId: dto.boardId,
      organizationId: organizationId || dto.organizationId,
    };
    this.devices.set(device.id, device);
    return device;
  }

  public async getBoardById(boardId: string, organizationId?: string): Promise<CompositeBoardDto> {
    try {
      return await this.getCompositeBoardHandler.execute({ boardId });
    } catch (err: any) {
      throw new EntityNotFoundError(`Board with ID ${boardId} not found.`);
    }
  }
}
