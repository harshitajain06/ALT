/** User-facing text when Firebase Storage returns 412 (bucket / IAM linkage). */
export function formatFirebaseStorageError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    /412|Precondition Failed|service account is missing|required service account/i.test(
      msg
    )
  ) {
    return [
      "Storage upload failed (412): Firebase must be allowed to use your Cloud Storage bucket.",
      "In Firebase Console open Storage and use any “Attach permissions” / banner action.",
      "Also confirm Project settings → General shows the same default bucket you use in this app, and Billing is active if required.",
      "https://firebase.google.com/support/faq#storage-accounts",
    ].join(" ");
  }
  return msg;
}
