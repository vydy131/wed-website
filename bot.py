#!/usr/bin/env python3
"""
Telegram-бот: приём голосов с сайта + /stats.

Запуск:
    pip install -r requirements.txt
    python bot.py

Сайт шлёт POST http://<host>:8080/vote  { "drinks": ["Шампанское", "Пиво"] }
Бот пишет уведомление в CHAT_ID и сохраняет счётчики в votes.json.
/stats — статистика по напиткам.
"""
import asyncio
import json
import os

from aiohttp import web
from aiohttp.web_middlewares import middleware
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

load_dotenv()

# ── Настройки ────────────────────────────────────────────────────────────────

BOT_TOKEN = os.environ['BOT_TOKEN']
CHAT_ID   = os.environ['CHAT_ID']
PORT      = int(os.environ.get('PORT', 8080))
DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'votes.json')

# ── Хранилище (votes.json) ───────────────────────────────────────────────────

def load_votes() -> dict:
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {'total': 0, 'drinks': {}}


def save_votes(data: dict) -> None:
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# ── CORS middleware ───────────────────────────────────────────────────────────

@middleware
async def cors_middleware(request: web.Request, handler) -> web.Response:
    if request.method == 'OPTIONS':
        return web.Response(status=204, headers={
            'Access-Control-Allow-Origin':  '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        })
    response = await handler(request)
    response.headers['Access-Control-Allow-Origin'] = '*'
    return response

# ── POST /vote ────────────────────────────────────────────────────────────────

async def vote_handler(request: web.Request) -> web.Response:
    try:
        body   = await request.json()
        drinks = body.get('drinks', [])

        if not isinstance(drinks, list) or not drinks:
            return web.Response(status=400, text='drinks must be a non-empty list')

        data = load_votes()
        data['total'] += 1
        for drink in drinks:
            key = str(drink)
            data['drinks'][key] = data['drinks'].get(key, 0) + 1
        save_votes(data)

        # Уведомление в чат — при ошибке откатываем vote и возвращаем ok: False
        try:
            text = '🍾 Предпочтения по напиткам:\n' + ', '.join(drinks)
            await request.app['bot'].send_message(chat_id=CHAT_ID, text=text)
        except Exception as e:
            print(f'[vote] Telegram notify error: {e}')
            data['total'] -= 1
            for drink in drinks:
                key = str(drink)
                data['drinks'][key] -= 1
                if data['drinks'][key] <= 0:
                    del data['drinks'][key]
            save_votes(data)
            return web.json_response({'ok': False, 'error': str(e)})

        return web.json_response({'ok': True})

    except Exception as e:
        print(f'[vote] error: {e}')
        return web.Response(status=500, text=str(e))

# ── /stats ────────────────────────────────────────────────────────────────────

async def stats_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    data  = load_votes()
    total = data['total']

    if total == 0:
        await update.message.reply_text('Пока нет голосов.')
        return

    lines = [
        '📊 *Статистика напитков*',
        f'Проголосовавших: *{total}*\n',
    ]
    for drink, count in sorted(data['drinks'].items(), key=lambda x: -x[1]):
        pct    = round(count / total * 100)
        filled = round(pct / 10)
        bar    = '█' * filled + '░' * (10 - filled)
        lines.append(f'*{drink}*: {pct}% ({count}/{total})\n{bar}')

    await update.message.reply_text('\n'.join(lines), parse_mode='Markdown')

# ── /reset ───────────────────────────────────────────────────────────────────

async def reset_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    data  = load_votes()
    total = data['total']

    if total == 0:
        await update.message.reply_text('Нечего сбрасывать — голосов нет.')
        return

    lines = [
        '📊 *Статистика перед сбросом*',
        f'Проголосовавших: *{total}*\n',
    ]
    for drink, count in sorted(data['drinks'].items(), key=lambda x: -x[1]):
        pct    = round(count / total * 100)
        filled = round(pct / 10)
        bar    = '█' * filled + '░' * (10 - filled)
        lines.append(f'*{drink}*: {pct}% ({count}/{total})\n{bar}')

    lines.append('\n🗑 Статистика очищена.')
    save_votes({'total': 0, 'drinks': {}})

    await update.message.reply_text('\n'.join(lines), parse_mode='Markdown')

# ── Запуск ────────────────────────────────────────────────────────────────────

async def main() -> None:
    tg_app = Application.builder().token(BOT_TOKEN).build()
    tg_app.add_handler(CommandHandler('stats', stats_command))
    tg_app.add_handler(CommandHandler('reset', reset_command))

    async with tg_app:
        # После initialize() tg_app.bot готов — передаём его в web_app
        web_app = web.Application(middlewares=[cors_middleware])
        web_app['bot'] = tg_app.bot
        web_app.router.add_post('/vote', vote_handler)

        runner = web.AppRunner(web_app)
        await runner.setup()
        await web.TCPSite(runner, '0.0.0.0', PORT).start()
        print(f'✅ HTTP сервер на порту {PORT}')

        await tg_app.start()
        await tg_app.updater.start_polling()
        print('✅ Telegram бот запущен. Жду команды...')

        try:
            await asyncio.Event().wait()
        except (KeyboardInterrupt, SystemExit):
            pass
        finally:
            await tg_app.updater.stop()
            await tg_app.stop()
            await runner.cleanup()


if __name__ == '__main__':
    asyncio.run(main())
