# WeCoop Smart Contracts

**On-chain posting, polls, and reward experiments for WeCoop.**

This AlgoKit workspace contains the TEALScript contracts behind WeCoop's social and community features. It keeps TypeScript contract source alongside generated TEAL, application specifications, typed clients, and Jest integration tests.

The companion [WeCoop client](https://github.com/p2arthur/wecoop_client) provides the user interface.

## Contract modules

| Project | Contract | Implemented surface |
| --- | --- | --- |
| [`projects/file_posts/`](projects/file_posts/) | `WecoopFilePost` | Create file posts, record likes and replies, and read post data from boxes |
| [`projects/test_contract/`](projects/test_contract/) | `WecoopDao` | Create polls, accept votes, track participation, and withdraw poll shares |
| [`projects/wecoop_rewards/`](projects/wecoop_rewards/) | `WecoopRewards` | Configure a reward asset, initiate cycles, and experiment with posting rewards |

The `test_contract` folder is the poll/DAO implementation despite its original scaffold name. Some methods, including file-post flagging and reward voting, remain empty. This is historical development code, without a claim of audit coverage or deployment readiness.

## Read the source

Start with each project's `contracts/*.algo.ts`, then its `__test__/` folder. Contract artifacts and generated clients live under `contracts/artifacts/` and `contracts/clients/` respectively.

File-post records include the creator, timestamp, asset, content identifier, format, text, and interaction counts. Poll records track the question, selected asset, timing, votes, and deposited value. The tests show transaction-group construction and expected contract behavior.

## Build a module

Use Node.js/npm and the AlgoKit CLI. Each subproject has its own dependency lockfile and build scripts.

```sh
git clone https://github.com/p2arthur/wecoop_smart_contracts.git
cd wecoop_smart_contracts/projects/file_posts
npm ci
npm run build
```

`build` compiles TEALScript and generates TypeScript clients. Run the same commands in `projects/test_contract` or `projects/wecoop_rewards` to work on another module.

| Command | Purpose |
| --- | --- |
| `npm run compile-contract` | Compile contract source into artifacts |
| `npm run generate-client` | Generate typed clients from application specifications |
| `npm run build` | Compile and regenerate clients |
| `npm test` | Build and run Jest integration tests |
| `npm run lint` | Check TypeScript formatting and lint rules |

Integration tests require an appropriately configured Algorand LocalNet and test accounts. Read each module's README and test setup before running them. No network deployment is necessary to inspect or compile the source.

## Historical tooling

These contracts use **TEALScript** and the AlgoKit utilities versions recorded in their lockfiles. They are not a PuyaTs migration. Preserve that distinction when comparing the code with newer Algorand tooling or regenerating artifacts.
