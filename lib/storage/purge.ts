/**
 * Deletes every object under a prefix in a bucket (Storage has no recursive delete). Walks folders breadth-first
 * with paging, removes files in batches. Works with any client the caller passes — the user's (RLS decides) or the
 * service role's.
 */

interface ListedItem {
  name: string;
  /** null for folders */
  id: string | null;
}

export interface StorageBucketLike {
  list(
    prefix: string,
    options: { limit: number; offset: number },
  ): Promise<{ data: ListedItem[] | null; error: unknown }>;
  remove(paths: string[]): Promise<{ error: unknown }>;
}

const PAGE = 1000;
const BATCH = 100;

export async function purgePrefix(bucket: StorageBucketLike, prefix: string): Promise<number> {
  const files: string[] = [];
  const folders = [prefix.replace(/\/+$/, "")];
  while (folders.length) {
    const folder = folders.shift()!;
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await bucket.list(folder, { limit: PAGE, offset });
      if (error) throw error;
      for (const item of data ?? []) {
        const path = `${folder}/${item.name}`;
        if (item.id === null) folders.push(path);
        else files.push(path);
      }
      if (!data || data.length < PAGE) break;
    }
  }
  for (let i = 0; i < files.length; i += BATCH) {
    const { error } = await bucket.remove(files.slice(i, i + BATCH));
    if (error) throw error;
  }
  return files.length;
}
