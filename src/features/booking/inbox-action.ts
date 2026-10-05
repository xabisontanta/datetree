/** A lost response does not prove that the persisted transition failed. */
export async function runInboxAction(action: () => Promise<{ error: string }>) {
  try {
    const result = await action();
    return { ...result, refresh: !result.error };
  } catch {
    return {
      error:
        'We could not confirm whether this action finished. Refreshing the saved status; check it before trying again.',
      refresh: true,
    };
  }
}
