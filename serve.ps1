param(
  [int]$Port = 5173
)

$ErrorActionPreference = "Stop"

function Get-ContentType([string]$Path) {
  switch -Regex ($Path) {
    "\.html$" { return "text/html; charset=utf-8" }
    "\.css$"  { return "text/css; charset=utf-8" }
    "\.js$"   { return "text/javascript; charset=utf-8" }
    "\.json$" { return "application/json; charset=utf-8" }
    "\.png$"  { return "image/png" }
    "\.jpg$"  { return "image/jpeg" }
    "\.jpeg$" { return "image/jpeg" }
    "\.svg$"  { return "image/svg+xml; charset=utf-8" }
    default   { return "application/octet-stream" }
  }
}

$Root = (Resolve-Path ".").Path
$Prefix = "http://localhost:$Port/"

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($Prefix)
$listener.Start()

Write-Host "Serving $Root at $Prefix"
Write-Host "Press Ctrl+C to stop."

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response

    $path = $req.Url.AbsolutePath.TrimStart("/")
    if ([string]::IsNullOrWhiteSpace($path)) { $path = "index.html" }
    $path = $path -replace "/", "\"

    $full = Join-Path $Root $path

    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
      $res.StatusCode = 404
      $bytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
      $res.ContentType = "text/plain; charset=utf-8"
      $res.ContentLength64 = $bytes.Length
      if ($req.HttpMethod -ne "HEAD") {
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      }
      $res.Close()
      continue
    }

    $bytes = [System.IO.File]::ReadAllBytes($full)
    $res.StatusCode = 200
    $res.ContentType = (Get-ContentType $full)
    $res.AddHeader("Cache-Control", "no-store")
    $res.ContentLength64 = $bytes.Length
    if ($req.HttpMethod -ne "HEAD") {
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    }
    $res.Close()
  }
} finally {
  $listener.Stop()
  $listener.Close()
}

