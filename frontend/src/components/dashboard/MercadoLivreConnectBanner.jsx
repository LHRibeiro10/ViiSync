function MercadoLivreConnectBanner({
  hasMercadoLivreConnected,
  connectingMercadoLivre,
  onConnectMercadoLivre,
}) {
  if (hasMercadoLivreConnected) {
    return null;
  }

  return (
    <section className="dashboard-ml-connect-box">
      <div className="dashboard-ml-connect-copy">
        <span className="dashboard-ml-connect-tag">Integracao pendente</span>
        <h2>Conecte sua conta do Mercado Livre</h2>
        <p>
          Para sincronizar pedidos, produtos e perguntas, conecte agora sua conta com o
          mesmo fluxo OAuth usado no botao de reconectar.
        </p>
      </div>

      <button
        type="button"
        className="dashboard-ml-connect-button"
        onClick={onConnectMercadoLivre}
        disabled={connectingMercadoLivre}
      >
        {connectingMercadoLivre ? "Abrindo OAuth..." : "Conectar conta Mercado Livre"}
      </button>
    </section>
  );
}

export default MercadoLivreConnectBanner;
