!include "MUI2.nsh"
!include "FileFunc.nsh"

; Define defaults if not provided via command line
!ifndef OUTFILE
  !define OUTFILE "../release/mDiff-Setup-5.1.0.exe"
!endif
!ifndef SRCDIR
  !define SRCDIR "../release/win-unpacked"
!endif

; General configuration
Name "mDiff"
Caption "mDiff Comparison Suite Setup"
OutFile "${OUTFILE}"
InstallDir "$PROGRAMFILES64\mDiff"
InstallDirRegKey HKLM "Software\Mavenir\mDiff" "InstallLocation"
RequestExecutionLevel admin
SetCompressor /SOLID lzma

; Interface Configuration
!define MUI_ABORTWARNING
!define MUI_ICON "../public/icon.ico"
!define MUI_UNICON "../public/icon.ico"

; Welcome & Directory & InstFiles Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

!define MUI_FINISHPAGE_RUN "$INSTDIR\mDiff.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch mDiff Comparison Suite"
!insertmacro MUI_PAGE_FINISH

; Uninstaller Pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Languages
!insertmacro MUI_LANGUAGE "English"

; Version Information
VIProductVersion "5.1.0.0"
VIAddVersionKey "ProductName" "mDiff"
VIAddVersionKey "CompanyName" "Mavenir"
VIAddVersionKey "LegalCopyright" "Copyright © 2026 Mavenir"
VIAddVersionKey "FileDescription" "mDiff Enterprise Comparison Suite Setup"
VIAddVersionKey "FileVersion" "5.1.0.0"
VIAddVersionKey "ProductVersion" "5.1.0.0"

Section "MainSection" SecMain
    SetOutPath "$INSTDIR"
    
    ; Copy all unpacked production files recursively
    File /r "${SRCDIR}/*.*"
    
    ; Generate Uninstaller in Program Files directory
    WriteUninstaller "$INSTDIR\Uninstall mDiff.exe"
    
    ; Create Start Menu Shortcuts
    CreateDirectory "$SMPROGRAMS\mDiff"
    CreateShortcut "$SMPROGRAMS\mDiff\mDiff.lnk" "$INSTDIR\mDiff.exe" "" "$INSTDIR\mDiff.exe" 0
    CreateShortcut "$SMPROGRAMS\mDiff\Uninstall mDiff.lnk" "$INSTDIR\Uninstall mDiff.exe" "" "$INSTDIR\Uninstall mDiff.exe" 0
    
    ; Create Desktop Shortcut
    CreateShortcut "$DESKTOP\mDiff.lnk" "$INSTDIR\mDiff.exe" "" "$INSTDIR\mDiff.exe" 0
    
    ; Register in Windows Add/Remove Programs (Registry) for Intune and Company Portal
    WriteRegStr HKLM "Software\Mavenir\mDiff" "InstallLocation" "$INSTDIR"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\mDiff" "DisplayName" "mDiff"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\mDiff" "DisplayVersion" "5.1.0"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\mDiff" "Publisher" "Mavenir"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\mDiff" "DisplayIcon" "$INSTDIR\mDiff.exe,0"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\mDiff" "UninstallString" '"$INSTDIR\Uninstall mDiff.exe"'
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\mDiff" "QuietUninstallString" '"$INSTDIR\Uninstall mDiff.exe" /S'
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\mDiff" "InstallLocation" "$INSTDIR"
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\mDiff" "NoModify" 1
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\mDiff" "NoRepair" 1
    
    ; Calculate installed size for Windows Add/Remove Programs
    ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
    IntFmt $0 "0x%08X" $0
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\mDiff" "EstimatedSize" "$0"
SectionEnd

Section "Uninstall"
    ; Remove Start Menu Shortcuts
    Delete "$SMPROGRAMS\mDiff\mDiff.lnk"
    Delete "$SMPROGRAMS\mDiff\Uninstall mDiff.lnk"
    RMDir "$SMPROGRAMS\mDiff"
    
    ; Remove Desktop Shortcut
    Delete "$DESKTOP\mDiff.lnk"
    
    ; Remove all installed files and directories
    RMDir /r "$INSTDIR\locales"
    RMDir /r "$INSTDIR\resources"
    Delete "$INSTDIR\*.*"
    RMDir "$INSTDIR"
    
    ; Clean up Registry Keys
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\mDiff"
    DeleteRegKey HKLM "Software\Mavenir\mDiff"
SectionEnd
