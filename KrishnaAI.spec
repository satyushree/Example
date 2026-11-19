# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['run.py'],
    pathex=[],
    binaries=[],
    datas=[('frontend', 'frontend'), ('backend/plugins', 'backend/plugins')],
    hiddenimports=['backend.plugins.weather_plugin', 'backend.plugins.whatsapp_plugin', 'backend.plugins.telegram_plugin', 'uvicorn.protocols.http.auto', 'uvicorn.protocols.http.h11_impl', 'uvicorn.protocols.websockets.auto', 'uvicorn.protocols.websockets.websockets_impl', 'uvicorn.loops.auto', 'uvicorn.loops.asyncio', 'uvicorn.lifespan.on', 'websockets.legacy.server'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='KrishnaAI',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
