function MercadoLivreSyncButton({
  hasMercadoLivreConnected,
  syncing,
  isMarketplaceSyncing,
  connectingMercadoLivre,
  connectedLabel,
  onSync,
  onConnect,
  className = "panel-link",
}) {
  const isBusy = hasMercadoLivreConnected
    ? syncing || isMarketplaceSyncing
    : connectingMercadoLivre;

  return (
    <button
      type="button"
      className={className}
      onClick={hasMercadoLivreConnected ? onSync : onConnect}
      disabled={isBusy}
    >
      {hasMercadoLivreConnected
        ? syncing || isMarketplaceSyncing
          ? "Sincronizando..."
          : connectedLabel
        : connectingMercadoLivre
          ? "Abrindo OAuth..."
          : "Conectar Mercado Livre"}
    </button>
  );
}

export default MercadoLivreSyncButton;
