import { useQuery } from '@tanstack/react-query';
import { driveApi } from '../../drive/api/driveApi';
import { getDriveFileId } from '../../drive/lib/driveFileReference';

export function useProjectCoverUrl(reference?: string | null): string | undefined {
  const fileId = getDriveFileId(reference);
  const query = useQuery({
    queryKey: ['drive-image-preview-url', fileId],
    enabled: Boolean(fileId),
    staleTime: 8 * 60 * 1000,
    queryFn: () => driveApi.createPreviewUrl(fileId!),
  });
  return fileId ? query.data?.url : reference || undefined;
}
