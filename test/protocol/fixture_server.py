"""Disposable loopback S7Comm test fixture. Synthetic DB1 only; never use on a production network."""
import logging
import os
import signal
import struct
import threading

from snap7.server import Server
from snap7.type import SrvArea

LISTEN_ADDRESS = "127.0.0.1"
LISTEN_PORT = int(os.environ.get("S7_FIXTURE_PORT", "1102"))
if not 1024 <= LISTEN_PORT <= 65535:
    raise ValueError("S7 test port must be unprivileged")
stop_requested = threading.Event()


def request_stop(_signal_number, _frame):
    stop_requested.set()


def main():
    logging.basicConfig(level=logging.WARNING)
    synthetic_db = bytearray(64)
    struct.pack_into(">f", synthetic_db, 0, 12.5)
    struct.pack_into(">h", synthetic_db, 4, -123)
    struct.pack_into(">f", synthetic_db, 8, 3.25)

    server = Server(log=False, max_clients=2)
    # The pure-Python server retains its own writable bytearray copy.
    server.register_area(SrvArea.DB, 1, synthetic_db)
    signal.signal(signal.SIGTERM, request_stop)
    signal.signal(signal.SIGINT, request_stop)
    try:
        server.start_to(LISTEN_ADDRESS, LISTEN_PORT)
        print("S7_WIRE_FIXTURE_READY", flush=True)
        while not stop_requested.wait(0.2):
            pass
    finally:
        server.stop()
        print("S7_WIRE_FIXTURE_STOPPED", flush=True)


if __name__ == "__main__":
    main()
