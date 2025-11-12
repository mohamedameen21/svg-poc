<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\SvgSanitizerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class SvgSanitizerController extends Controller
{
    public function sanitize(Request $request): JsonResponse
    {
        $isFileUpload = $request->hasFile('file');
        $isPastedCode = $request->has('svg_code');

        $rules = [
            'auto_detect' => 'boolean',
            'custom_keywords' => 'nullable|string',
            'manual_remove_ids' => 'nullable|string',
        ];

        if ($isFileUpload) {
            $rules['file'] = 'required|file|mimes:svg|max:10240'; // Max 10MB
        } elseif ($isPastedCode) {
            $rules['svg_code'] = 'required|string|max:10485760'; // Max 10MB as string
        } else {
            return response()->json([
                'success' => false,
                'message' => 'Either file or svg_code must be provided',
            ], 422);
        }

        // Color mapping feature disabled for now - only predefined color schemes
        // if ($request->has('color_mapping')) {
        //     $rules['color_mapping'] = 'required|array';
        // } else {
            $rules['color'] = 'nullable|string|in:green,blue,red,purple,orange,teal';
        // }

        $validator = Validator::make($request->all(), $rules);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $colorScheme = $request->input('color');
            $autoDetect = $request->input('auto_detect', true);
            // Color mapping feature disabled
            // $colorMapping = $request->input('color_mapping', []);

            // Parse optional parameters
            $customKeywords = $request->input('custom_keywords')
                ? array_map('trim', explode(',', $request->input('custom_keywords')))
                : [];

            $manualRemoveIds = $request->input('manual_remove_ids')
                ? array_map('trim', explode(',', $request->input('manual_remove_ids')))
                : [];

            // Create sanitizer service
            $sanitizer = new SvgSanitizerService(
                $autoDetect,
                $customKeywords,
                $manualRemoveIds
            );

            // Handle file upload or pasted code
            if ($isFileUpload) {
                $file = $request->file('file');
                $originalName = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);
                $tempPath = $file->store('temp', 'local');
                $fullTempPath = Storage::disk('local')->path($tempPath);

                // Only use color scheme, no color mapping
                $result = $sanitizer->sanitize($fullTempPath, $colorScheme, []);

                Storage::disk('local')->delete($tempPath);
            } else {
                $svgCode = $request->input('svg_code');
                $originalName = 'pasted-svg';

                // Only use color scheme, no color mapping
                $result = $sanitizer->sanitizeFromString($svgCode, $colorScheme, []);
            }

            // Generate unique filename for sanitized SVG
            $suffix = $colorScheme ? $colorScheme : 'custom';
            $sanitizedFilename = Str::slug($originalName) . '-' . $suffix . '-' . time() . '.svg';

            // Save sanitized SVG to public storage
            Storage::disk('public')->put(
                'sanitized/' . $sanitizedFilename,
                $result['content']
            );

            // Generate download URL
            $downloadUrl = Storage::disk('public')->url('sanitized/' . $sanitizedFilename);

            // Return success response
            return response()->json([
                'success' => true,
                'message' => 'Sanitization complete',
                'download_url' => $downloadUrl,
                'filename' => $sanitizedFilename,
                'detected_logos' => $result['detected_logos'],
                'removed_count' => $result['removed_count'],
            ]);

        } catch (\Exception $e) {
            // Log error
            \Log::error('SVG Sanitization Error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Sanitization failed: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function detectColors(Request $request): JsonResponse
    {
        // Validate request
        $isFileUpload = $request->hasFile('file');
        $isPastedCode = $request->has('svg_code');

        if (!$isFileUpload && !$isPastedCode) {
            return response()->json([
                'success' => false,
                'message' => 'Either file or svg_code must be provided',
            ], 422);
        }

        try {
            $sanitizer = new SvgSanitizerService();

            if ($isFileUpload) {
                $file = $request->file('file');
                $svgContent = file_get_contents($file->getRealPath());
            } else {
                $svgContent = $request->input('svg_code');
            }

            $colors = $sanitizer->detectColors($svgContent);

            return response()->json([
                'success' => true,
                'colors' => $colors,
                'count' => count($colors),
            ]);

        } catch (\Exception $e) {
            \Log::error('Color Detection Error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Color detection failed: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function download(string $filename): \Symfony\Component\HttpFoundation\BinaryFileResponse|JsonResponse
    {
        $filePath = 'sanitized/' . $filename;

        if (!Storage::disk('public')->exists($filePath)) {
            return response()->json([
                'success' => false,
                'message' => 'File not found',
            ], 404);
        }

        return Storage::disk('public')->download($filePath, $filename, [
            'Content-Type' => 'image/svg+xml',
        ]);
    }

    public function colorSchemes(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'schemes' => [
                [
                    'name' => 'green',
                    'label' => 'Green',
                    'color' => '#10b981',
                    'description' => 'Fresh green tones',
                ],
                [
                    'name' => 'blue',
                    'label' => 'Blue',
                    'color' => '#3b82f6',
                    'description' => 'Cool blue shades',
                ],
                [
                    'name' => 'red',
                    'label' => 'Red',
                    'color' => '#ef4444',
                    'description' => 'Bold red hues',
                ],
                [
                    'name' => 'purple',
                    'label' => 'Purple',
                    'color' => '#a855f7',
                    'description' => 'Rich purple tones',
                ],
                [
                    'name' => 'orange',
                    'label' => 'Orange',
                    'color' => '#f97316',
                    'description' => 'Vibrant orange shades',
                ],
                [
                    'name' => 'teal',
                    'label' => 'Teal',
                    'color' => '#14b8a6',
                    'description' => 'Modern teal colors',
                ],
            ],
        ]);
    }
}
