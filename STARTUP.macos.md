# Step 1

Install SuperCollider

```sh
brew install supercollider
```

# Step 2

Install FoxDot

```sh
pip install foxdot
```

# Step 3

Setup `startup.scd`

```sh
echo $'Quarks.install("FoxDot");\nFoxDot.start' > ~/Library/Application\ Support/SuperCollider/startup.scd
```

# Step 4

Start sclang

```sh
/Applications/SuperCollider.app/Contents/MacOS/sclang
```

# Step 5

Start FoxDot Extension
