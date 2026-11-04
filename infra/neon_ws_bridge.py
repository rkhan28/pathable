"""Local TCP -> Neon WebSocket gateway bridge, for networks that block port 5432.

Listens on 127.0.0.1:55432 and forwards each connection's bytes to
wss://<neon host>/v2, which speaks the Postgres wire protocol.
Usage: python neon_ws_bridge.py <neon host>
"""

import asyncio
import sys

import websockets

HOST = sys.argv[1]


async def handle(reader, writer):
    async with websockets.connect(f"wss://{HOST}/v2", max_size=None, ping_interval=20, ping_timeout=60) as ws:

        async def up():
            while data := await reader.read(65536):
                await ws.send(data)
            await ws.close()

        async def down():
            async for msg in ws:
                writer.write(msg if isinstance(msg, bytes) else msg.encode())
                await writer.drain()
            writer.close()

        await asyncio.gather(up(), down(), return_exceptions=True)


async def main():
    server = await asyncio.start_server(handle, "127.0.0.1", 55432)
    print("bridge listening on 127.0.0.1:55432", flush=True)
    async with server:
        await server.serve_forever()


asyncio.run(main())
