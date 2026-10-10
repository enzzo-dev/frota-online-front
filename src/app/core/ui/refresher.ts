/** Ends the pull-to-refresh spinner of an `ion-refresher` from its `ionRefresh` event. */
export function completeRefresh(event: Event): void {
  const refresher = event.target as { complete?: () => void } | null;
  refresher?.complete?.();
}
