const { spawnSync } = require('node:child_process');

exports.default = async function sign(context) {
    const params = {
        Endpoint: 'https://eus.codesigning.azure.net/',
        CodeSigningAccountName: process.env.CODESIGNING_ACCOUNT_NAME || '',
        CertificateProfileName: process.env.CERTIFICATE_PROFILE_NAME || '', //'<certificate profile name>',
        FilesFolder: context.appOutDir,
        FilesFolderFilter: 'exe,dll',
        FileDigest: 'SHA256',
        TimestampRfc3161: 'http://timestamp.acs.microsoft.com',
        TimestampDigest: 'SHA256',
    };
    spawnSync('powershell.exe', ['Invoke-TrustedSigning', params], { shell: true, stdio: 'inherit' });
};