import { useState, useCallback, FormEvent, DragEvent, ChangeEvent } from 'react';
import { Head } from '@inertiajs/react';
import GuestLayout from '@/layouts/guest-layout';

interface ColorScheme {
    name: string;
    label: string;
    color: string;
    description: string;
}

interface DetectedLogo {
    [id: string]: string;
}

interface SanitizeResult {
    success: boolean;
    message: string;
    download_url?: string;
    filename?: string;
    detected_logos?: DetectedLogo;
    removed_count?: number;
    errors?: Record<string, string[]>;
}

interface ColorMapping {
    source: string;
    target: string;
}

const colorSchemes: ColorScheme[] = [
    { name: 'green', label: 'Green', color: '#10b981', description: 'Fresh green tones' },
    { name: 'blue', label: 'Blue', color: '#3b82f6', description: 'Cool blue shades' },
    { name: 'red', label: 'Red', color: '#ef4444', description: 'Bold red hues' },
    { name: 'purple', label: 'Purple', color: '#a855f7', description: 'Rich purple tones' },
    { name: 'orange', label: 'Orange', color: '#f97316', description: 'Vibrant orange shades' },
    { name: 'teal', label: 'Teal', color: '#14b8a6', description: 'Modern teal colors' },
];

export default function SvgSanitizerEnhanced() {
    // Input mode: 'file' or 'paste'
    const [inputMode, setInputMode] = useState<'file' | 'paste'>('file');
    const [file, setFile] = useState<File | null>(null);
    const [svgCode, setSvgCode] = useState<string>('');

    const [colorMode, setColorMode] = useState<'scheme' | 'mapping'>('scheme');
    const [selectedColor, setSelectedColor] = useState<string>('green');
    const [colorMappings, setColorMappings] = useState<ColorMapping[]>([]);

    const [autoDetect, setAutoDetect] = useState<boolean>(true);
    const [customKeywords, setCustomKeywords] = useState<string>('');
    const [manualRemoveIds, setManualRemoveIds] = useState<string>('');
    const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [result, setResult] = useState<SanitizeResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Handle file selection
    const handleFileChange = useCallback((selectedFile: File | null) => {
        if (selectedFile) {
            if (selectedFile.type !== 'image/svg+xml' && !selectedFile.name.endsWith('.svg')) {
                setError('Please upload a valid SVG file');
                return;
            }
            if (selectedFile.size > 10 * 1024 * 1024) {
                setError('File size must be less than 10MB');
                return;
            }
            setFile(selectedFile);
            setError(null);
            setResult(null);
            setColorMappings([]);
        }
    }, []);

    const handleSvgCodeChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
        const code = e.target.value;
        setSvgCode(code);
        setError(null);
        setResult(null);
        setColorMappings([]);
    }, []);

    const handleDragEnter = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDragOver = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            handleFileChange(droppedFile);
        }
    }, [handleFileChange]);

    // Form submission
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (inputMode === 'file' && !file) {
            setError('Please select a file');
            return;
        }

        if (inputMode === 'paste' && !svgCode.trim()) {
            setError('Please paste SVG code');
            return;
        }

        setIsUploading(true);
        setError(null);
        setResult(null);

        try {
            const formData = new FormData();

            if (inputMode === 'file' && file) {
                formData.append('file', file);
            } else {
                formData.append('svg_code', svgCode);
            }

            formData.append('auto_detect', autoDetect ? '1' : '0');

            if (colorMode === 'scheme') {
                formData.append('color', selectedColor);
            } else {
                // Send color mapping as array (FormData doesn't handle nested objects well)
                colorMappings.forEach((m) => {
                    if (m.source !== m.target) {
                        formData.append(`color_mapping[${m.source}]`, m.target);
                    }
                });
            }

            if (customKeywords.trim()) {
                formData.append('custom_keywords', customKeywords.trim());
            }

            if (manualRemoveIds.trim()) {
                formData.append('manual_remove_ids', manualRemoveIds.trim());
            }

            // Get CSRF token
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

            const response = await fetch('/api/svg/sanitize', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': csrfToken || '',
                    'Accept': 'application/json',
                },
                body: formData,
            });

            const data: SanitizeResult = await response.json();

            if (response.ok && data.success) {
                setResult(data);
            } else {
                setError(data.message || 'Sanitization failed');
            }
        } catch (err) {
            setError('An error occurred. Please try again.');
            console.error('Upload error:', err);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <GuestLayout>
            <Head title="SVG Sanitizer - Enhanced" />

            <div className="px-4 py-8 sm:px-6 lg:px-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        SVG Sanitizer (Enhanced)
                    </h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">
                        Upload SVG or paste code, detect colors, map them to new colors, and remove logos automatically.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                    {/* Main Form */}
                    <div className="lg:col-span-2">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Input Mode Selection */}
                            <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                                <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                                    Input Method
                                </h2>

                                <div className="mb-4 flex gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setInputMode('file')}
                                        className={`flex-1 rounded-lg border-2 px-4 py-2 font-medium transition-all ${
                                            inputMode === 'file'
                                                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                                                : 'border-gray-300 text-gray-700 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300'
                                        }`}
                                    >
                                        📁 Upload File
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setInputMode('paste')}
                                        className={`flex-1 rounded-lg border-2 px-4 py-2 font-medium transition-all ${
                                            inputMode === 'paste'
                                                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                                                : 'border-gray-300 text-gray-700 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300'
                                        }`}
                                    >
                                        📋 Paste Code
                                    </button>
                                </div>

                                {inputMode === 'file' ? (
                                    <div
                                        className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                                            isDragging
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                                : 'border-gray-300 dark:border-gray-600'
                                        }`}
                                        onDragEnter={handleDragEnter}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                    >
                                        <input
                                            type="file"
                                            accept=".svg,image/svg+xml"
                                            onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                            disabled={isUploading}
                                        />

                                        <div className="space-y-4">
                                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                                                <svg
                                                    className="h-8 w-8 text-gray-400"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                                    />
                                                </svg>
                                            </div>

                                            {file ? (
                                                <div>
                                                    <p className="font-medium text-gray-900 dark:text-white">
                                                        {file.name}
                                                    </p>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                                        {(file.size / 1024).toFixed(2)} KB
                                                    </p>
                                                </div>
                                            ) : (
                                                <div>
                                                    <p className="text-gray-700 dark:text-gray-300">
                                                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                                                            Click to upload
                                                        </span>
                                                        {' or drag and drop'}
                                                    </p>
                                                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                                        SVG files up to 10MB
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Paste SVG Code
                                        </label>
                                        <textarea
                                            value={svgCode}
                                            onChange={handleSvgCodeChange}
                                            placeholder="<svg>...</svg>"
                                            rows={10}
                                            className="w-full rounded-lg border border-gray-300 px-4 py-2 font-mono text-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                            disabled={isUploading}
                                        />
                                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                            Paste your SVG code directly here
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Color Configuration */}
                            <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                                <div className="mb-4 flex items-center justify-between">
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                        Color Configuration
                                    </h2>
                                    {/* <button
                                        type="button"
                                        onClick={detectColors}
                                        disabled={isDetectingColors || isUploading || (inputMode === 'file' && !file) || (inputMode === 'paste' && !svgCode.trim())}
                                        className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-700 disabled:bg-gray-400 dark:disabled:bg-gray-600"
                                    >
                                        {isDetectingColors ? 'Detecting...' : '🔍 Detect Colors'}
                                    </button> */}
                                </div>

                                <div className="mb-4 flex gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setColorMode('scheme')}
                                        className={`flex-1 rounded-lg border-2 px-4 py-2 font-medium transition-all ${
                                            colorMode === 'scheme'
                                                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                                                : 'border-gray-300 text-gray-700 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300'
                                        }`}
                                    >
                                        Preset Scheme
                                    </button>
                                    {/* <button
                                        type="button"
                                        onClick={() => setColorMode('mapping')}
                                        disabled={detectedColors.length === 0}
                                        className={`flex-1 rounded-lg border-2 px-4 py-2 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                            colorMode === 'mapping'
                                                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                                                : 'border-gray-300 text-gray-700 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300'
                                        }`}
                                    >
                                        Custom Mapping
                                    </button> */}
                                </div>

                                {colorMode === 'scheme' ? (
                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                        {colorSchemes.map((scheme) => (
                                            <button
                                                key={scheme.name}
                                                type="button"
                                                onClick={() => setSelectedColor(scheme.name)}
                                                className={`flex items-center gap-3 rounded-lg border-2 p-3 transition-all ${
                                                    selectedColor === scheme.name
                                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                                        : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                                                }`}
                                                disabled={isUploading}
                                            >
                                                <div
                                                    className="h-8 w-8 rounded-full"
                                                    style={{ backgroundColor: scheme.color }}
                                                />
                                                <div className="text-left">
                                                    <p className="font-medium text-gray-900 dark:text-white">
                                                        {scheme.label}
                                                    </p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )
                                : (
                                    <>
                                    </>
                                    // <div className="space-y-3">
                                    //     {detectedColors.length > 0 ? (
                                    //         <>
                                    //             <p className="text-sm text-gray-600 dark:text-gray-400">
                                    //                 Found {detectedColors.length} color(s). Map each source color to a target color:
                                    //             </p>
                                    //             {colorMappings.map((mapping, index) => (
                                    //                 <div key={index} className="flex items-center gap-4 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                                    //                     <div className="flex items-center gap-2">
                                    //                         <div
                                    //                             className="h-10 w-10 rounded border border-gray-300"
                                    //                             style={{ backgroundColor: mapping.source }}
                                    //                         />
                                    //                         <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
                                    //                             {mapping.source}
                                    //                         </span>
                                    //                     </div>

                                    //                     <span className="text-gray-400">→</span>

                                    //                     <div className="flex items-center gap-2">
                                    //                         <input
                                    //                             type="color"
                                    //                             value={mapping.target}
                                    //                             onChange={(e) => updateColorMapping(index, e.target.value)}
                                    //                             className="h-10 w-10 rounded border border-gray-300 cursor-pointer"
                                    //                         />
                                    //                         <select
                                    //                             value={mapping.target}
                                    //                             onChange={(e) => updateColorMapping(index, e.target.value)}
                                    //                             className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                    //                         >
                                    //                             {presetColors.map(color => (
                                    //                                 <option key={color} value={color}>
                                    //                                     {color}
                                    //                                 </option>
                                    //                             ))}
                                    //                         </select>
                                    //                     </div>
                                    //                 </div>
                                    //             ))}
                                    //         </>
                                    //     ) : (
                                    //         <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
                                    //             Click "Detect Colors" to scan your SVG for colors
                                    //         </p>
                                    //     )}
                                    // </div>
                                )}
                            </div>

                            {/* Advanced Options */}
                            <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                                <button
                                    type="button"
                                    onClick={() => setShowAdvanced(!showAdvanced)}
                                    className="flex w-full items-center justify-between text-lg font-semibold text-gray-900 dark:text-white"
                                >
                                    <span>Advanced Options</span>
                                    <svg
                                        className={`h-5 w-5 transition-transform ${
                                            showAdvanced ? 'rotate-180' : ''
                                        }`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M19 9l-7 7-7-7"
                                        />
                                    </svg>
                                </button>

                                {showAdvanced && (
                                    <div className="mt-4 space-y-4">
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={autoDetect}
                                                onChange={(e) => setAutoDetect(e.target.checked)}
                                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                disabled={isUploading}
                                            />
                                            <span className="text-gray-700 dark:text-gray-300">
                                                Enable automatic logo detection
                                            </span>
                                        </label>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Custom Keywords (comma-separated)
                                            </label>
                                            <input
                                                type="text"
                                                value={customKeywords}
                                                onChange={(e) => setCustomKeywords(e.target.value)}
                                                placeholder="e.g., custom-logo, brand-mark"
                                                className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                                disabled={isUploading}
                                            />
                                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                Additional keywords to detect logo elements
                                            </p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Manual IDs to Remove (comma-separated)
                                            </label>
                                            <input
                                                type="text"
                                                value={manualRemoveIds}
                                                onChange={(e) => setManualRemoveIds(e.target.value)}
                                                placeholder="e.g., element-1, group-5"
                                                className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                                disabled={isUploading}
                                            />
                                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                Specific element IDs to remove regardless of detection
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
                                    <div className="flex">
                                        <div className="flex-shrink-0">
                                            <svg
                                                className="h-5 w-5 text-red-400"
                                                viewBox="0 0 20 20"
                                                fill="currentColor"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </div>
                                        <div className="ml-3">
                                            <p className="text-sm font-medium text-red-800 dark:text-red-200">
                                                {error}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={
                                    (inputMode === 'file' && !file) ||
                                    (inputMode === 'paste' && !svgCode.trim()) ||
                                    isUploading
                                }
                                className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400 dark:disabled:bg-gray-600"
                            >
                                {isUploading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg
                                            className="h-5 w-5 animate-spin"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                        >
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                            />
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                            />
                                        </svg>
                                        Processing...
                                    </span>
                                ) : (
                                    'Sanitize SVG'
                                )}
                            </button>
                        </form>
                    </div>

                    {/* Results Panel */}
                    <div className="lg:col-span-1">
                        {result && result.success && (
                            <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                                <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                                    Sanitization Results
                                </h2>

                                {/* Success Message */}
                                <div className="mb-4 rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
                                    <div className="flex">
                                        <div className="flex-shrink-0">
                                            <svg
                                                className="h-5 w-5 text-green-400"
                                                viewBox="0 0 20 20"
                                                fill="currentColor"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </div>
                                        <div className="ml-3">
                                            <p className="text-sm font-medium text-green-800 dark:text-green-200">
                                                {result.message}
                                            </p>
                                            <p className="mt-1 text-xs text-green-700 dark:text-green-300">
                                                Removed {result.removed_count} element(s)
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Detected Logos */}
                                {result.detected_logos && Object.keys(result.detected_logos).length > 0 && (
                                    <div className="mb-4">
                                        <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                                            Detected Logo Elements:
                                        </h3>
                                        <div className="max-h-64 space-y-2 overflow-y-auto">
                                            {Object.entries(result.detected_logos).map(([id, reason]) => (
                                                <div
                                                    key={id}
                                                    className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700"
                                                >
                                                    <p className="break-all font-mono text-sm font-semibold text-gray-900 dark:text-white">
                                                        {id}
                                                    </p>
                                                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                                                        {reason}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Download Button */}
                                <a
                                    href={result.download_url}
                                    download={result.filename}
                                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-green-700"
                                >
                                    <svg
                                        className="h-5 w-5"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                        />
                                    </svg>
                                    Download Sanitized SVG
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </GuestLayout>
    );
}
