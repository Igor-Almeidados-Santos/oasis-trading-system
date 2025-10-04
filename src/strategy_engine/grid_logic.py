class GridStrategy:
    """Lógica pura da estratégia de Grid Trading."""
    def __init__(self, grid_levels: int, grid_spacing_pct: float, order_size: float):
        self.grid_levels = grid_levels
        self.grid_spacing_pct = grid_spacing_pct / 100
        self.order_size = order_size
        self.grid = {}
        self.last_price = None
        print("Lógica de Grid Trading inicializada.")

    def create_grid(self, center_price: float):
        """Cria a grade de preços em torno de um preço central."""
        self.grid = {}
        for i in range(1, self.grid_levels + 1):
            # Níveis de compra abaixo do preço central
            buy_price = center_price * (1 - i * self.grid_spacing_pct)
            self.grid[f"buy_{i}"] = {"price": round(buy_price, 2), "triggered": False}
            
            # Níveis de venda acima do preço central
            sell_price = center_price * (1 + i * self.grid_spacing_pct)
            self.grid[f"sell_{i}"] = {"price": round(sell_price, 2), "triggered": False}
        
        self.last_price = center_price
        print(f"Grade criada em torno de ${center_price:.2f}")
        # print(self.grid)

    def process_price_update(self, new_price: float) -> list:
        """Processa um novo preço e retorna uma lista de sinais."""
        if not self.grid:
            self.create_grid(new_price)
            return []

        signals = []
        
        # Lógica para disparar ordens de compra
        if new_price < self.last_price:
            for level_id, level_info in self.grid.items():
                if level_id.startswith("buy") and not level_info["triggered"]:
                    if new_price <= level_info["price"]:
                        signals.append({"side": "BUY", "price": level_info["price"], "quantity": self.order_size})
                        level_info["triggered"] = True
                        print(f"--- SINAL DE COMPRA GERADO @ ${level_info['price']:.2f} ---")

        # Lógica para disparar ordens de venda
        elif new_price > self.last_price:
            for level_id, level_info in self.grid.items():
                if level_id.startswith("sell") and not level_info["triggered"]:
                    if new_price >= level_info["price"]:
                        signals.append({"side": "SELL", "price": level_info["price"], "quantity": self.order_size})
                        level_info["triggered"] = True
                        print(f"--- SINAL DE VENDA GERADO @ ${level_info['price']:.2f} ---")

        self.last_price = new_price
        return signals