import type { ContactSubmission, PrismaClient } from "../../generated/prisma/client.js";
import { getPrismaClient } from "../../db/prismaClient.js";

export interface CreateContactSubmissionInput {
  fullName: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

export class ContactRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async create(input: CreateContactSubmissionInput): Promise<ContactSubmission> {
    return this.prisma.contactSubmission.create({ data: input });
  }
}
