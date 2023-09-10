import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Confirmation } from './entities/confirmation.entity';
import { CreateConfirmationDto } from './dto/create-confirmation.dto';
import { Patient } from '../users/patient/entities/patient.entity';

@Injectable()
export class ConfirmationService {
  constructor(
    @InjectRepository(Confirmation)
    private readonly confirmationRepository: Repository<Confirmation>,

    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
  ) {}

  async createConfirmation(
    createConfirmationDto: CreateConfirmationDto,
  ): Promise<Confirmation> {
    const { patientcode, ...confirmationData } = createConfirmationDto;

    const user = await this.patientRepository.findOne({
      where: { codigo: patientcode },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const confirmation = this.confirmationRepository.create({
      ...confirmationData,
    });
    try {
      await this.confirmationRepository.manager
        .createQueryBuilder()
        .insert()
        .into(Confirmation)
        .values({
          patient: confirmation.patient,
          arrivaltime: confirmation.arrivaltime,
          appointmenttime: confirmation.appointmenttime,
          confirmationstatus: confirmation.confirmationstatus,
          codigoProcedimento: confirmation.codigoProcedimento,
          motivoAtendimento: confirmation.motivoAtendimento,
          tratamento: confirmation.tratamento,
          caraterAtendimento: confirmation.caraterAtendimento,
          cid: confirmation.cid,
          diagnostico: confirmation.diagnostico,
          nomeUnidade: confirmation.nomeUnidade,
          enderecoUnidade: confirmation.enderecoUnidade,
          municipioUnidade: confirmation.municipioUnidade,
          ufUnidade: confirmation.ufUnidade,
        })
        .execute();

      return confirmation;
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException('A confirmação já existe');
      } else {
        throw new InternalServerErrorException('Falha ao criar confirmação');
      }
    }
  }

  async getConfirmationById(id: number): Promise<Confirmation> {
    const confirmation = await this.confirmationRepository.findOne({
      where: { id },
    });
    if (!confirmation) {
      throw new NotFoundException('Confirmação não encontrada');
    }
    return confirmation;
  }

  async getAllConfirmations(): Promise<Confirmation[]> {
    try {
      return this.confirmationRepository.find();
    } catch (error) {
      throw new InternalServerErrorException('Falha ao buscar as confirmações');
    }
  }

  async updateConfirmation(
    id: number,
    updateConfirmationDto: CreateConfirmationDto,
  ): Promise<Confirmation> {
    const confirmation = await this.getConfirmationById(id);
    if (!confirmation) {
      // Lógica de tratamento caso a confirmação não seja encontrada
      throw new NotFoundException('Confirmação não encontrada');
    }

    try {
      if (
        updateConfirmationDto.appointmenttime >= confirmation.appointmenttime
      ) {
        throw new ForbiddenException(
          'Não é possível atualizar a confirmação após a data agendada',
        );
      }
      const updatedConfirmation = Object.assign(
        confirmation,
        updateConfirmationDto,
      );
      return this.confirmationRepository.save(updatedConfirmation);
    } catch (error) {
      // Lógica de tratamento de erro durante a atualização da confirmação
      throw new InternalServerErrorException(
        'A atualização da confirmação falhou',
      );
    }
  }

  async deleteConfirmation(id: number): Promise<void> {
    const confirmation = await this.confirmationRepository.findOne({
      where: { id },
    });

    if (!confirmation) {
      throw new NotFoundException('Confirmação não encontrada');
    }
    const currentTime = new Date();
    const appointmentTime = new Date(confirmation.appointmenttime);
    const timeDifference = currentTime.getTime() - appointmentTime.getTime();
    const minutesDifference = Math.floor(timeDifference / 1000 / 60);

    if (minutesDifference <= 30) {
      throw new ForbiddenException(
        'Não é possível cancelar a confirmação com menos de 30 minutos de antecedência',
      );
    }
    try {
      await this.confirmationRepository.manager
        .createQueryBuilder()
        .delete()
        .from(Confirmation)
        .where('id = :id', { id: confirmation.id })
        .execute();
      await this.confirmationRepository.remove(confirmation);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error.message;
      } else if (error instanceof ForbiddenException) {
        throw error.message;
      } else {
        throw new InternalServerErrorException(
          'Não foi possível deletar a confirmação',
        );
      }
    }
  }
}
