import { IsString, IsObject, IsNumber, IsOptional } from 'class-validator'

export class UploadAndAnalyzeDto {
  @IsString()
  projectId: string

  @IsObject()
  questionnaireData: {
    respondentInfo: {
      name: string
      department?: string
      position?: string
      submittedAt: string
    }
    answers: Record<string, string>
    totalScore: number
    maxScore: number
  }
}
