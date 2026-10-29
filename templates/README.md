# __NAME__

<What it is and where the game uses it.> Native __W__x__H__, standing on `(__OX__, __OY__)`.
A seed alone gives a different __NAME__. Variety: __VARIETY__ (<what changes from seed to seed>).

## Features and files

| File | Feature |
| --- | --- |
__FILES__

## Inputs

| Input | Values |
| --- | --- |
| `kind` | 0 rolls; <1 ..., 2 ..., 3 ...> |
| `tint` | transparent rolls the colour; any other colour sets it |

A rolled `kind` renders exactly like the same kind forced.

## Outputs

__OUTPUTS__

## Checking

```sh
node <skill>/scripts/check-asset.mjs __STEM__
node <skill>/scripts/sheet.mjs __STEM__/__STEM__.ips --sweep kind=1,2,3 --seeds 1-8
```

Peak fuel: <from check-asset>. `seeds.txt` holds the seeds to compare across revisions.
