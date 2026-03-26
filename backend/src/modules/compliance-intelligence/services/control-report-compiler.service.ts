import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PackResolverService } from '../../applicability-engine/services/pack-resolver.service'
import { ControlGapInputService } from '../../survey/control-gap-input.service'
import type { ControlGapInputItemDto } from '../../survey/dto/control-gap-input.dto'
import {
  CompileControlReportDto,
  CompileControlReportResponseDto,
  ControlReportCaseDto,
  ControlReportClauseDto,
  ControlReportControlNodeDto,
  ControlReportEvidenceDto,
  ControlReportL2SectionDto,
  ControlReportSectionDto,
} from '../dto/compile-control-report.dto'
import { ControlExplainService } from './control-explain.service'

type ExplainResult = Awaited<ReturnType<ControlExplainService['getControlExplain']>>

@Injectable()
export class ControlReportCompilerService {
  constructor(
    private readonly packResolverService: PackResolverService,
    private readonly controlExplainService: ControlExplainService,
    private readonly controlGapInputService: ControlGapInputService,
  ) {}

  async compileReport(
    input: CompileControlReportDto,
  ): Promise<CompileControlReportResponseDto> {
    if (input.controlIds.length === 0) {
      throw new BadRequestException('controlIds must contain at least one control id')
    }

    const applicableControls = await this.packResolverService.resolveByOrganizationId(
      input.organizationId,
    )
    const applicableControlIds = new Set(
      applicableControls.controls.map((control) => control.controlId),
    )
    const invalidControlIds = input.controlIds.filter(
      (controlId) => !applicableControlIds.has(controlId),
    )

    if (invalidControlIds.length > 0) {
      throw new NotFoundException(
        `Controls not applicable to organization: ${invalidControlIds.join(', ')}`,
      )
    }

    const gapInput = await this.controlGapInputService.getControlGapInput(
      input.surveyResponseId,
      input.organizationId,
    )
    const gapMap = new Map(gapInput.controls.map((control) => [control.controlId, control]))

    const explainResults = await Promise.all(
      input.controlIds.map(async (controlId) => ({
        controlId,
        gap: gapMap.get(controlId),
        explain: await this.controlExplainService.getControlExplain(controlId, {
          organizationId: input.organizationId,
        }),
      })),
    )

    return {
      sections: this.buildSections(explainResults),
    }
  }

  private buildSections(
    items: Array<{
      controlId: string
      gap?: ControlGapInputItemDto
      explain: ExplainResult
    }>,
  ): ControlReportSectionDto[] {
    const sections = new Map<
      string,
      {
        l1Code: string
        l1Name: string
        l2Sections: Map<
          string,
          {
            l2Code: string
            l2Name: string
            controls: ControlReportControlNodeDto[]
          }
        >
      }
    >()

    items.forEach(({ controlId, gap, explain }) => {
      const l1Code = explain.control.l1.code
      const l1Name = explain.control.l1.name ?? explain.control.l1.code
      const l2Code = explain.control.l2.code
      const l2Name = explain.control.l2.name ?? explain.control.l2.code

      const section =
        sections.get(l1Code) ??
        {
          l1Code,
          l1Name,
          l2Sections: new Map<
            string,
            { l2Code: string; l2Name: string; controls: ControlReportControlNodeDto[] }
          >(),
        }
      const l2Section =
        section.l2Sections.get(l2Code) ??
        {
          l2Code,
          l2Name,
          controls: [],
        }

      l2Section.controls.push({
        controlId,
        controlCode: explain.control.controlCode,
        controlName: explain.control.controlName,
        currentStatus: gap?.currentStatus ?? 'INCOMPLETE',
        gapLevel: gap?.gapLevel ?? 'HIGH',
        clauses: this.mapClauses(explain.clauses),
        cases: this.mapCases(explain.cases),
        evidences: this.mapEvidences(explain.evidences),
      })

      section.l2Sections.set(l2Code, l2Section)
      sections.set(l1Code, section)
    })

    return Array.from(sections.values())
      .sort((left, right) => left.l1Code.localeCompare(right.l1Code))
      .map((section) => ({
        l1Code: section.l1Code,
        l1Name: section.l1Name,
        l2Sections: Array.from(section.l2Sections.values())
          .sort((left, right) => left.l2Code.localeCompare(right.l2Code))
          .map((l2Section): ControlReportL2SectionDto => ({
            l2Code: l2Section.l2Code,
            l2Name: l2Section.l2Name,
            controls: l2Section.controls
              .slice()
              .sort((left, right) => left.controlCode.localeCompare(right.controlCode)),
          })),
      }))
  }

  private mapClauses(items: Array<Record<string, unknown>>): ControlReportClauseDto[] {
    return items
      .map((item) => ({
        clauseId: item.clauseId as string,
        clauseCode: item.clauseCode as string,
        articleNo: (item.articleNo as string | null | undefined) ?? null,
        clauseSummary: (item.clauseSummary as string | null | undefined) ?? null,
        sourceName:
          (((item.source as Record<string, unknown> | undefined) ?? {}).sourceName as
            | string
            | null
            | undefined) ?? null,
      }))
      .sort((left, right) => left.clauseCode.localeCompare(right.clauseCode))
  }

  private mapCases(items: Array<Record<string, unknown>>): ControlReportCaseDto[] {
    return items
      .map((item) => ({
        caseId: item.caseId as string,
        caseCode: item.caseCode as string,
        caseTitle: (item.caseTitle as string | null | undefined) ?? null,
        sourceOrg: (item.sourceOrg as string | null | undefined) ?? null,
        authorityName: (item.authorityName as string | null | undefined) ?? null,
      }))
      .sort((left, right) => left.caseCode.localeCompare(right.caseCode))
  }

  private mapEvidences(items: Array<Record<string, unknown>>): ControlReportEvidenceDto[] {
    return items
      .map((item) => ({
        id: item.id as string,
        evidenceId: item.evidenceId as string,
        evidenceCode: item.evidenceCode as string,
        evidenceName: item.evidenceName as string,
        evidenceDesc: (item.evidenceDesc as string | null | undefined) ?? null,
        evidenceCategory: (item.evidenceCategory as string | null | undefined) ?? null,
        status: item.status as string,
        requiredLevel: item.requiredLevel as string,
        notes: (item.notes as string | null | undefined) ?? null,
      }))
      .sort((left, right) => left.evidenceCode.localeCompare(right.evidenceCode))
  }
}
