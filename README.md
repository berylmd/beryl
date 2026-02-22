# Red Beryl

![Red Beryl](https://upload.wikimedia.org/wikipedia/commons/f/fa/Beryl-235618.jpg)

> What if Beryl, but javascript?

Expriments for a simpler beryl archetecture.

- pnpm
- turborepo
- electron
- capacitor

---

# Running

## Prereqs

- `pnpm`

This project uses pnpm workspaces, so have pnpm installed globally.

## Deps

```
# in /beryl-red dir
pnpm i
```

## Development

```
pnpm run dev
```

will spin up 2 dev servers and launch the electron app.

## Prod Build

```
pnpm run build
```

# Native Setup (mac only)

```
brew install cocoapods
brew install openjdk@17
echo 'export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```
manually install xcode
manually install android studio

## Run

```
pnpm run dev-android
pnpm run dev-ios
```