/** Words every area of the panel uses. An area keeps its own wording otherwise. */
export const common = {
  save: 'Save',
  saving: 'Saving…',
  cancel: 'Cancel',
  close: 'Close',
  reset: 'Reset',
  remove: 'Remove',
  delete: 'Delete',
  add: 'Add',
  edit: 'Edit',
  confirm: 'Confirm',
  retry: 'Try again',
  loading: 'Loading…',
  none: 'None',
  unknown: 'Unknown',
  /** Prefix for an error the server reported, e.g. "Error: File too large". */
  errorWith: (message: string) => `Error: ${message}`,
};
