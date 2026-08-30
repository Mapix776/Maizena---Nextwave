export interface GenerateReportInput {
  requestId: string;
  prompt: string;
}

export interface ReportArtifactDescriptor {
  artifactId: string;
  revisionId: string;
  kind: 'custom-report';
  title: string;
  status: 'accepted';
  previewUrl: string;
  createdAt: string;
}

export interface ArtifactGenerationService {
  generate(input: GenerateReportInput): Promise<ReportArtifactDescriptor>;
}

export interface AcceptedArtifactLookup {
  findByRequestId(requestId: string): Promise<ReportArtifactDescriptor | null>;
}
