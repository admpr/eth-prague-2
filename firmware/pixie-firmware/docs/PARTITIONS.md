Partition Table
===============

The partition table is flashed during provisioning and created within
the [provision tool](https://github.com/firefly/pixie-repl) with the
following configuration:

```
const table = new PartitionTable(16 * 1024 * 1024);
table.addPartition("attest", "data", "nvs", 0x009000, 0x7000, true);
table.addPartition("factory", "app", "factory", 0x0010000, 0x700000, false);
table.addPartition("nvs", "data", "nvs", 0x0f00000, 0x100000, false);
```

The bootloader and *attestation data* are also flashed during provisioning,
so it is important when flashing a device to not overwrite these partitions.

In general, when uisng the `idf.py` command, only the `app-flash` should
be used to add new firmware, preserving the other partitions.


Layout
------

| Type          | Name      | Offset            | Size             | Purpose              |
| :------------ | :-------- | :---------------- | :--------------- | :------------------- |
| *bootloader*  |           | `0x0` (0kb)       | `0x8000` (32kb)  | 2nd stage bootloader |
| *partitions*  |           | `0x8000` (32kb)   | `0x1000` (4kb)   | partition table      |
| `data/nvs`    | `attest`  | `0x9000` (36kb)   | `0x7000` (28kb)  | provision data       |
| `app/factory` | `factory` | `0x10000` (64kb)  | `0x700000` (7Mb) | firmware             |
| *unused*      |           | `0x710000`        | `0x7f0000`       | reserved             | 
| `data/nvs`    | `nvs`     | `0xf00000` (15Mb) | `0x100000` (1Mb) | user storage         |

There is a reserved space for future use, which is being invetigsted.
Currently we are considering 2 options:

1. a single ~15Mb partition for the factory app
2. a small (simple) factory app with DFU support and a single OTA partition, which the factory app would be responsible for failed flash (to the OTA) recovery
