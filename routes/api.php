<?php

use App\Http\Controllers\Api\SvgSanitizerController;
use Illuminate\Support\Facades\Route;

// SVG Sanitizer API routes
Route::prefix('svg')->group(function () {
    Route::post('/sanitize', [SvgSanitizerController::class, 'sanitize'])->name('api.svg.sanitize');
    Route::get('/download/{filename}', [SvgSanitizerController::class, 'download'])->name('api.svg.download');
    Route::get('/color-schemes', [SvgSanitizerController::class, 'colorSchemes'])->name('api.svg.color-schemes');
});
