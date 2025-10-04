from src.common.db_manager import PostgresManager

class PositionManager:
    def __init__(self, product_id: str):
        self.product_id = product_id
        self.db_manager = PostgresManager()
        self.position_size = 0.0
        self.average_price = 0.0
        self.realized_pnl = 0.0
        self._load_position_from_fills()

    def _load_position_from_fills(self):
        """Calcula a posição atual a partir do histórico de execuções."""
        query = "SELECT o.side, f.quantity, f.price FROM fills f JOIN orders o ON f.order_id = o.id WHERE o.product_id = %s"
        fills = self.db_manager.execute_query(query, (self.product_id,), fetch="all")

        if not fills:
            print("Nenhuma execução anterior encontrada para a posição.")
            return

        total_quantity = 0
        total_cost = 0
        for fill in fills:
            quantity = float(fill['quantity'])
            price = float(fill['price'])
            if fill['side'] == 'BUY':
                total_quantity += quantity
                total_cost += quantity * price
            else: # SELL
                # Ao vender, realizamos o PnL
                pnl = (price - self.average_price) * quantity
                self.realized_pnl += pnl
                total_quantity -= quantity
                total_cost -= quantity * self.average_price # Reduz o custo com base no preço médio
        
        self.position_size = total_quantity
        if self.position_size > 0:
            self.average_price = total_cost / self.position_size
        else:
            self.average_price = 0

        print(f"Posição carregada: {self.position_size} {self.product_id} @ Preço Médio ${self.average_price:.2f}")

    def get_unrealized_pnl(self, current_market_price: float) -> float:
        """Calcula o PnL não realizado com base no preço de mercado atual."""
        if self.position_size == 0:
            return 0.0
        return (current_market_price - self.average_price) * self.position_size

    def get_total_exposure_usd(self) -> float:
        """Retorna a exposição total em USD."""
        return self.position_size * self.average_price