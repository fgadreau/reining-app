$ErrorActionPreference = "Stop"

try {
  $socket = [System.Net.Sockets.UdpClient]::new()
  $socket.Connect("1.1.1.1", 53)
  $address = ([System.Net.IPEndPoint]$socket.Client.LocalEndPoint).Address
  $socket.Dispose()

  if ($address.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork) {
    $address.IPAddressToString
    exit 0
  }
} catch {
  if ($socket) {
    $socket.Dispose()
  }
}

$configuration = Get-NetIPConfiguration |
  Where-Object {
    $_.IPv4DefaultGateway -ne $null -and
    $_.NetAdapter.Status -eq "Up" -and
    $_.IPv4Address.IPAddress -notlike "169.254.*"
  } |
  Select-Object -First 1

if ($configuration) {
  $configuration.IPv4Address.IPAddress | Select-Object -First 1
}
