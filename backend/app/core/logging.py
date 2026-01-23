import logging


def configure_logging(level: str) -> None:
    logging.basicConfig(
        level=level.upper(),
        format=(
            "%(asctime)s level=%(levelname)s logger=%(name)s "
            "module=%(module)s func=%(funcName)s msg=%(message)s"
        ),
        datefmt="%Y-%m-%dT%H:%M:%S%z",
        force=True,
    )
