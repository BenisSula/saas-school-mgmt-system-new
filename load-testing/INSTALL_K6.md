# K6 Installation Guide

## Windows Installation

### Option 1: Using Chocolatey (Recommended)
```powershell
choco install k6
```

### Option 2: Using Scoop
```powershell
scoop install k6
```

### Option 3: Manual Installation
1. Download the latest Windows release from: https://github.com/grafana/k6/releases
2. Extract the zip file
3. Add the extracted folder to your PATH environment variable
4. Verify installation: `k6 version`

### Option 4: Using Docker (No Installation Required)
```bash
docker run --rm -i grafana/k6 run - < load-testing/k6-load-test.js
```

## macOS Installation
```bash
brew install k6
```

## Linux Installation
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D9
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

## Verify Installation
```bash
k6 version
```

## Quick Start
Once installed, run:
```bash
k6 run load-testing/k6-load-test.js
```

