import os
import httpx
import asyncio
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text('Oasis Bot Ativo. Use /status ou /trades.')

async def get_status(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Faz uma chamada HTTP para o WebService para obter o status."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get("http://webservice:8000/api/status")
            response.raise_for_status()
            data = response.json()
            
            message = (
                f"📊 *Status da Posição*\n\n"
                f"Produto: `{data['product_id']}`\n"
                f"Tamanho: `{float(data['position_size']):.6f}`\n"
                f"Preço Médio: `${float(data['average_price']):.2f}`\n"
                f"PnL Realizado: `${float(data['realized_pnl']):.4f}`"
            )
            await update.message.reply_text(message, parse_mode='Markdown')
            
    except httpx.RequestError as e:
        await update.message.reply_text(f"Erro ao contatar o serviço: {e}")
    except Exception as e:
        await update.message.reply_text(f"Ocorreu um erro: {e}")

async def get_trades(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Obtém os últimos trades do WebService."""
    # ... (implementação similar ao get_status) ...
    await update.message.reply_text("Comando /trades ainda em implementação.")

def main() -> None:
    """Inicia o bot do Telegram."""
    TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
    ALLOWED_USER_ID = int(os.getenv("TELEGRAM_ALLOWED_USER_ID"))

    application = Application.builder().token(TOKEN).build()

    # Filtra mensagens para apenas o usuário permitido
    user_filter = filters.User(user_id=ALLOWED_USER_ID)

    application.add_handler(CommandHandler("start", start, filters=user_filter))
    application.add_handler(CommandHandler("status", get_status, filters=user_filter))
    application.add_handler(CommandHandler("trades", get_trades, filters=user_filter))

    print("Bot do Telegram iniciado e aguardando comandos...")
    application.run_polling()

if __name__ == '__main__':
    main()