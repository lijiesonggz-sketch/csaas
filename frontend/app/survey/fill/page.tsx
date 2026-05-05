import SurveyFillClient from './SurveyFillClient'

type SearchParams = Record<string, string | string[] | undefined>

interface SurveyFillPageProps {
  searchParams?: SearchParams
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default function SurveyFillPage({ searchParams = {} }: SurveyFillPageProps) {
  return (
    <SurveyFillClient
      questionnaireTaskId={firstParam(searchParams.questionnaireTaskId)}
      surveyId={firstParam(searchParams.surveyId)}
    />
  )
}
