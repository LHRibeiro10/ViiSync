import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getOrders } from "../services/api";
import OrdersToolbar from "../components/orders/OrdersToolbar";
import OrdersSummaryGrid from "../components/orders/OrdersSummaryGrid";
import OrdersOpsStrip from "../components/orders/OrdersOpsStrip";
import OrdersTable from "../components/orders/OrdersTable";
import {
  normalizeValue,
  buildDefaultCustomRange,
  resolveRangeByPreset,
  loadStoredFilters,
  buildOrdersInsights,
  ORDER_FILTER_STORAGE_KEY,
} from "../utils/ordersInsights";
import "./Orders.css";

function Orders() {
  const storedFilters = loadStoredFilters();
  const navigate = useNavigate();
  const [ordersPayload, setOrdersPayload] = useState({
    items: [],
    summary: {
      totalOrders: 0,
      grossRevenue: 0,
      netReceived: 0,
      averageTicket: 0,
    },
    meta: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMarketplace, setSelectedMarketplace] = useState("all");
  const [datePreset, setDatePreset] = useState(storedFilters.preset);
  const [customRange, setCustomRange] = useState(storedFilters.customRange);

  const activeRange = useMemo(
    () => resolveRangeByPreset(datePreset, customRange),
    [customRange, datePreset]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.sessionStorage.setItem(
      ORDER_FILTER_STORAGE_KEY,
      JSON.stringify({
        preset: datePreset,
        customRange,
      })
    );
  }, [customRange, datePreset]);

  useEffect(() => {
    async function loadOrders() {
      if (!activeRange?.start || !activeRange?.end) {
        if (datePreset === "custom") {
          setError("Defina um intervalo personalizado valido.");
        }
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const payload = await getOrders({
          preset: datePreset,
          startAt: activeRange.start.toISOString(),
          endAt: activeRange.end.toISOString(),
        });

        setOrdersPayload(payload);
      } catch (loadError) {
        setError(loadError?.message || "Nao foi possivel carregar os pedidos.");
      } finally {
        setLoading(false);
      }
    }

    loadOrders();
  }, [activeRange, datePreset]);

  if (loading) return <div className="screen-message">Carregando pedidos...</div>;
  if (error) return <div className="screen-message">{error}</div>;

  const orders = Array.isArray(ordersPayload?.items) ? ordersPayload.items : [];
  const marketplaceOptions = Array.from(
    new Set(orders.map((order) => order.marketplace).filter(Boolean))
  ).sort((left, right) => left.localeCompare(right));

  const normalizedSearchTerm = normalizeValue(searchTerm);
  const filteredOrders = orders.filter((order) => {
    const matchesMarketplace =
      selectedMarketplace === "all" || order.marketplace === selectedMarketplace;

    const matchesSearch =
      normalizedSearchTerm.length === 0 ||
      [
        order.id,
        order.product,
        order.marketplace,
        order.status,
        order.account,
      ].some((value) => normalizeValue(value).includes(normalizedSearchTerm));

    return matchesMarketplace && matchesSearch;
  });

  const { filteredSummary, grossRevenue, netReceived, averageTicket, operationalInsights } =
    buildOrdersInsights(filteredOrders);
  const shouldScrollOrders = filteredOrders.length > 10;
  const hasOrdersInPeriod = orders.length > 0;

  function handleResetFilters() {
    setSearchTerm("");
    setSelectedMarketplace("all");
  }

  function handleExpandPeriod() {
    setDatePreset("last30");
    setCustomRange(buildDefaultCustomRange());
  }

  return (
    <div className="orders-page">
      <div className="orders-header">
        <div>
          <span className="tag">Operacao</span>
          <h1>Pedidos</h1>
          <p>Visualize as vendas sincronizadas e acompanhe os dados principais.</p>
        </div>
      </div>

      <div className="orders-panel">
        <OrdersToolbar
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          selectedMarketplace={selectedMarketplace}
          onSelectedMarketplaceChange={setSelectedMarketplace}
          marketplaceOptions={marketplaceOptions}
          datePreset={datePreset}
          onDatePresetChange={setDatePreset}
          customRange={customRange}
          onCustomRangeChange={setCustomRange}
        />

        <OrdersSummaryGrid
          totalOrders={filteredSummary.totalOrders}
          grossRevenue={grossRevenue}
          netReceived={netReceived}
          averageTicket={averageTicket}
        />

        <OrdersOpsStrip operationalInsights={operationalInsights} />

        <OrdersTable
          filteredOrders={filteredOrders}
          hasOrdersInPeriod={hasOrdersInPeriod}
          shouldScrollOrders={shouldScrollOrders}
          onResetFilters={handleResetFilters}
          onExpandPeriod={handleExpandPeriod}
          onNavigateToDashboard={() => navigate("/")}
        />
      </div>
    </div>
  );
}

export default Orders;
