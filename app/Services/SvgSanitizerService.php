<?php

namespace App\Services;

use DOMDocument;
use DOMElement;
use DOMXPath;
use Exception;
use Illuminate\Support\Facades\Log;

class SvgSanitizerService
{
    // private const LOGO_KEYWORDS = [
    //     'logo', 'brand', 'emblem', 'crest', 'shield', 'badge', 'text', 'ball',
    //     'watermark', 'inter', 'milan', 'atletico', 'madrid', 'barcelona', 'real',
    //     'juventus', 'bayern', 'liverpool', 'manchester', 'chelsea', 'arsenal',
    //     'tottenham', 'psg', 'dortmund', 'white', 'giuseppe', 'meazza', 'siro', 'svg-pan-zoom'
    // ];

    private const LOGO_KEYWORDS = [
        'logo', 'brand', 'watermark', 'svg-pan-zoom'
    ];

    private const PRESERVE_KEYWORDS = [
        'categories', 'seat', 'section', 'tier', 'stand', 'row', 'level',
        'block', 'area', 'zone', 'gate', 'entrance', 'exit', 'field',
        'pitch', 'stadium', 'svg-pan-zoom_viewport'
    ];

    private const COLOR_SCHEMES = [
        'green' => 120,
        'blue' => 210,
        'red' => 0,
        'purple' => 280,
        'orange' => 30,
        'teal' => 180,
    ];

    private const DECORATIVE_LOGO_THRESHOLD = 5;

    private bool $autoDetect;
    private array $customKeywords;
    private array $manualRemoveIds;
    private array $colorCache = []; // Cache to ensure consistent color transformations

    public function __construct(
        bool $autoDetect = true,
        array $customKeywords = [],
        array $manualRemoveIds = []
    ) {
        $this->autoDetect = $autoDetect;
        $this->customKeywords = array_map('strtolower', $customKeywords);
        $this->manualRemoveIds = $manualRemoveIds;
    }

    public function sanitize(string $filePath, ?string $colorScheme = null, array $colorMapping = []): array
    {
        if (!file_exists($filePath)) {
            throw new Exception("File not found: {$filePath}");
        }

        if ($colorScheme && !isset(self::COLOR_SCHEMES[$colorScheme])) {
            throw new Exception("Invalid color scheme: {$colorScheme}");
        }

        // Load SVG
        $dom = new DOMDocument();
        $dom->preserveWhiteSpace = false;
        $dom->formatOutput = true;

        // Suppress warnings for malformed SVG
        libxml_use_internal_errors(true);
        $loaded = $dom->load($filePath);
        libxml_clear_errors();

        if (!$loaded) {
            throw new Exception("Failed to parse SVG file");
        }

        $xpath = new DOMXPath($dom);

        // Detect and remove logo elements
        $detectedLogos = [];
        $removedCount = 0;

        if ($this->autoDetect) {
            $detectedLogos = $this->detectLogoElements($dom, $xpath);
            $removedCount = $this->removeElements($dom, $xpath, array_keys($detectedLogos));
        }

        // Remove manually specified IDs
        if (!empty($this->manualRemoveIds)) {
            $removedCount += $this->removeElements($dom, $xpath, $this->manualRemoveIds);
            foreach ($this->manualRemoveIds as $id) {
                if (!isset($detectedLogos[$id])) {
                    $detectedLogos[$id] = 'Manually specified for removal';
                }
            }
        }

        // Transform colors - only predefined color schemes supported
        // Custom color mapping disabled for now
        // if (!empty($colorMapping)) {
        //     // Use custom color mapping
        //     $this->applyColorMapping($dom, $xpath, $colorMapping);
        // } else
        if ($colorScheme) {
            // Use predefined color scheme
            $this->transformColors($dom, $xpath, $colorScheme);
        }

        // Save sanitized SVG
        $sanitizedContent = $dom->saveXML();

        return [
            'success' => true,
            'content' => $sanitizedContent,
            'detected_logos' => $detectedLogos,
            'removed_count' => $removedCount,
        ];
    }

    private function detectLogoElements(DOMDocument $dom, DOMXPath $xpath): array
    {
        $detected = [];
        $allKeywords = array_merge(self::LOGO_KEYWORDS, $this->customKeywords);

        // Get all elements with IDs
        $elements = $xpath->query('//*[@id]');

        foreach ($elements as $element) {
            $id = $element->getAttribute('id');
            $className = $element->getAttribute('class');
            $dataName = $element->getAttribute('data-name');

            // Check preservation keywords first
            if ($this->shouldPreserve($id, $className, $dataName)) {
                continue;
            }

            // Strategy 1: Keyword matching in ID, class, or data-name
            foreach ($allKeywords as $keyword) {
                $lowerKeyword = strtolower($keyword);
                if (
                    stripos(strtolower($id), $lowerKeyword) !== false ||
                    stripos(strtolower($className), $lowerKeyword) !== false ||
                    stripos(strtolower($dataName), $lowerKeyword) !== false
                ) {
                    $detected[$id] = "Contains keyword '{$keyword}' in ID/class/data-name";
                    break;
                }
            }

            // Strategy 2: Structural pattern detection for decorative logos
            if (!isset($detected[$id]) && $element->tagName === 'g') {
                $pathCount = $this->countChildElements($element, ['path', 'polygon']);
                if ($pathCount >= self::DECORATIVE_LOGO_THRESHOLD) {
                    $detected[$id] = "Group contains {$pathCount} paths/polygons (likely decorative logo)";
                }
            }
        }

        return $detected;
    }

    private function shouldPreserve(string $id, string $className, string $dataName): bool
    {
        foreach (self::PRESERVE_KEYWORDS as $keyword) {
            if (
                stripos(strtolower($id), $keyword) !== false ||
                stripos(strtolower($className), $keyword) !== false ||
                stripos(strtolower($dataName), $keyword) !== false
            ) {
                return true;
            }
        }
        return false;
    }

    private function countChildElements(DOMElement $element, array $tagNames): int
    {
        $count = 0;
        foreach ($element->childNodes as $child) {
            if ($child instanceof DOMElement && in_array($child->tagName, $tagNames)) {
                $count++;
            }
        }
        return $count;
    }

    private function removeElements(DOMDocument $dom, DOMXPath $xpath, array $ids): int
    {
        $removedCount = 0;
        foreach ($ids as $id) {
            $elements = $xpath->query("//*[@id='{$id}']");
            foreach ($elements as $element) {
                if ($element->parentNode) {
                    $element->parentNode->removeChild($element);
                    $removedCount++;
                }
            }
        }
        return $removedCount;
    }

    private function transformColors(DOMDocument $dom, DOMXPath $xpath, string $colorScheme): void
    {
        $targetHue = self::COLOR_SCHEMES[$colorScheme];

        // Reset color cache for each transformation to ensure consistency
        $this->colorCache = [];

        // Transform fill attributes
        $elementsWithFill = $xpath->query('//*[@fill]');
        foreach ($elementsWithFill as $element) {
            $fill = $element->getAttribute('fill');
            if ($fill !== 'none' && !empty($fill)) {
                $newColor = $this->transformColor($fill, $targetHue);
                $element->setAttribute('fill', $newColor);
            }
        }

        // Transform stroke attributes
        $elementsWithStroke = $xpath->query('//*[@stroke]');
        foreach ($elementsWithStroke as $element) {
            $stroke = $element->getAttribute('stroke');
            if ($stroke !== 'none' && !empty($stroke)) {
                $newColor = $this->transformColor($stroke, $targetHue);
                $element->setAttribute('stroke', $newColor);
            }
        }

        // Transform style attributes
        $elementsWithStyle = $xpath->query('//*[@style]');
        foreach ($elementsWithStyle as $element) {
            $style = $element->getAttribute('style');
            $newStyle = $this->transformStyleColors($style, $targetHue);
            $element->setAttribute('style', $newStyle);
        }

        // Transform CSS in <style> tags
        $styleTags = $dom->getElementsByTagName('style');
        foreach ($styleTags as $styleTag) {
            $css = $styleTag->textContent;
            $newCss = $this->transformCssColors($css, $targetHue);
            $styleTag->textContent = $newCss;
        }
    }

    private function transformColor(string $color, int $targetHue): string
    {
        $color = trim($color);

        // Normalize the color for cache key
        $normalizedColor = strtolower($color);

        // Check if we've already transformed this color
        if (isset($this->colorCache[$normalizedColor])) {
            return $this->colorCache[$normalizedColor];
        }

        // Parse RGB values
        $rgb = $this->parseColor($color);
        if (!$rgb) {
            return $color; // Return original if parsing fails
        }

        // Convert RGB to HSL
        $hsl = $this->rgbToHsl($rgb[0], $rgb[1], $rgb[2]);

        // Apply target hue with random variations
        $hsl[0] = $targetHue + rand(-10, 10); // ±10° hue variation
        $hsl[1] = max(0, min(100, $hsl[1] + rand(-5, 5))); // ±5% saturation
        $hsl[2] = max(0, min(100, $hsl[2] + rand(-3, 3))); // ±3% lightness

        // Convert back to RGB
        $newRgb = $this->hslToRgb($hsl[0], $hsl[1], $hsl[2]);

        // Return as hex
        $transformedColor = sprintf('#%02x%02x%02x', $newRgb[0], $newRgb[1], $newRgb[2]);

        // Cache the result for consistency
        $this->colorCache[$normalizedColor] = $transformedColor;

        return $transformedColor;
    }

    private function parseColor(string $color): ?array
    {
        // Hex format (#RGB or #RRGGBB)
        if (preg_match('/^#([0-9a-f]{3}|[0-9a-f]{6})$/i', $color, $matches)) {
            $hex = $matches[1];
            if (strlen($hex) === 3) {
                $r = hexdec($hex[0] . $hex[0]);
                $g = hexdec($hex[1] . $hex[1]);
                $b = hexdec($hex[2] . $hex[2]);
            } else {
                $r = hexdec(substr($hex, 0, 2));
                $g = hexdec(substr($hex, 2, 2));
                $b = hexdec(substr($hex, 4, 2));
            }
            return [$r, $g, $b];
        }

        // RGB/RGBA format
        if (preg_match('/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/i', $color, $matches)) {
            return [(int)$matches[1], (int)$matches[2], (int)$matches[3]];
        }

        return null;
    }

    private function rgbToHsl(int $r, int $g, int $b): array
    {
        $r /= 255;
        $g /= 255;
        $b /= 255;

        $max = max($r, $g, $b);
        $min = min($r, $g, $b);
        $l = ($max + $min) / 2;

        if ($max === $min) {
            $h = $s = 0; // Achromatic
        } else {
            $diff = $max - $min;
            $s = $l > 0.5 ? $diff / (2 - $max - $min) : $diff / ($max + $min);

            switch ($max) {
                case $r:
                    $h = (($g - $b) / $diff + ($g < $b ? 6 : 0));
                    break;
                case $g:
                    $h = ($b - $r) / $diff + 2;
                    break;
                case $b:
                    $h = ($r - $g) / $diff + 4;
                    break;
            }
            $h /= 6;
        }

        return [round($h * 360), round($s * 100), round($l * 100)];
    }

    private function hslToRgb(float $h, float $s, float $l): array
    {
        $h = fmod($h, 360) / 360;
        $s /= 100;
        $l /= 100;

        if ($s == 0) {
            $r = $g = $b = $l; // Achromatic
        } else {
            $hue2rgb = function ($p, $q, $t) {
                if ($t < 0) $t += 1;
                if ($t > 1) $t -= 1;
                if ($t < 1/6) return $p + ($q - $p) * 6 * $t;
                if ($t < 1/2) return $q;
                if ($t < 2/3) return $p + ($q - $p) * (2/3 - $t) * 6;
                return $p;
            };

            $q = $l < 0.5 ? $l * (1 + $s) : $l + $s - $l * $s;
            $p = 2 * $l - $q;
            $r = $hue2rgb($p, $q, $h + 1/3);
            $g = $hue2rgb($p, $q, $h);
            $b = $hue2rgb($p, $q, $h - 1/3);
        }

        return [round($r * 255), round($g * 255), round($b * 255)];
    }

    private function transformStyleColors(string $style, int $targetHue): string
    {
        // Match fill and stroke properties
        $style = preg_replace_callback(
            '/(fill|stroke):\s*([^;]+);?/i',
            function ($matches) use ($targetHue) {
                $property = $matches[1];
                $color = trim($matches[2]);
                if ($color !== 'none' && !empty($color)) {
                    $newColor = $this->transformColor($color, $targetHue);
                    return "{$property}: {$newColor};";
                }
                return $matches[0];
            },
            $style
        );

        return $style;
    }

    private function transformCssColors(string $css, int $targetHue): string
    {
        // Match color values in CSS
        $css = preg_replace_callback(
            '/(fill|stroke|color|background-color):\s*([^;}]+)/i',
            function ($matches) use ($targetHue) {
                $property = $matches[1];
                $color = trim($matches[2]);
                if ($color !== 'none' && !empty($color)) {
                    $newColor = $this->transformColor($color, $targetHue);
                    return "{$property}: {$newColor}";
                }
                return $matches[0];
            },
            $css
        );

        return $css;
    }

    public function detectColors(string $svgContent): array
    {
        $dom = new DOMDocument();
        $dom->preserveWhiteSpace = false;

        // Suppress warnings for malformed SVG
        libxml_use_internal_errors(true);
        $loaded = $dom->loadXML($svgContent);
        libxml_clear_errors();

        if (!$loaded) {
            throw new Exception("Failed to parse SVG content");
        }

        $xpath = new DOMXPath($dom);
        $colors = [];

        // Extract colors from fill attributes
        $elementsWithFill = $xpath->query('//*[@fill]');
        foreach ($elementsWithFill as $element) {
            $fill = $element->getAttribute('fill');
            if ($fill !== 'none' && !empty($fill) && $this->isValidColor($fill)) {
                $normalized = $this->normalizeColor($fill);
                if ($normalized) {
                    $colors[$normalized] = true;
                }
            }
        }

        // Extract colors from stroke attributes
        $elementsWithStroke = $xpath->query('//*[@stroke]');
        foreach ($elementsWithStroke as $element) {
            $stroke = $element->getAttribute('stroke');
            if ($stroke !== 'none' && !empty($stroke) && $this->isValidColor($stroke)) {
                $normalized = $this->normalizeColor($stroke);
                if ($normalized) {
                    $colors[$normalized] = true;
                }
            }
        }

        // Extract colors from style attributes
        $elementsWithStyle = $xpath->query('//*[@style]');
        foreach ($elementsWithStyle as $element) {
            $style = $element->getAttribute('style');
            preg_match_all('/(fill|stroke|color|background-color):\s*([^;]+)/i', $style, $matches);
            foreach ($matches[2] as $color) {
                $color = trim($color);
                if ($color !== 'none' && !empty($color) && $this->isValidColor($color)) {
                    $normalized = $this->normalizeColor($color);
                    if ($normalized) {
                        $colors[$normalized] = true;
                    }
                }
            }
        }

        // Extract colors from <style> tags
        $styleTags = $dom->getElementsByTagName('style');
        foreach ($styleTags as $styleTag) {
            $css = $styleTag->textContent;
            preg_match_all('/(fill|stroke|color|background-color):\s*([^;}]+)/i', $css, $matches);
            foreach ($matches[2] as $color) {
                $color = trim($color);
                if ($color !== 'none' && !empty($color) && $this->isValidColor($color)) {
                    $normalized = $this->normalizeColor($color);
                    if ($normalized) {
                        $colors[$normalized] = true;
                    }
                }
            }
        }

        return array_keys($colors);
    }

    private function isValidColor(string $color): bool
    {
        $color = trim($color);
        // Hex color
        if (preg_match('/^#[0-9a-f]{3,6}$/i', $color)) {
            return true;
        }
        // RGB/RGBA color
        if (preg_match('/^rgba?\(/i', $color)) {
            return true;
        }
        return false;
    }

    private function normalizeColor(string $color): ?string
    {
        $rgb = $this->parseColor($color);
        if (!$rgb) {
            return null;
        }
        return sprintf('#%02x%02x%02x', $rgb[0], $rgb[1], $rgb[2]);
    }

    private function applyColorMapping(DOMDocument $dom, DOMXPath $xpath, array $colorMapping): void
    {
        // Normalize all color mappings
        $normalizedMapping = [];
        foreach ($colorMapping as $source => $target) {
            $sourceNorm = $this->normalizeColor($source);
            $targetNorm = $this->normalizeColor($target);
            if ($sourceNorm && $targetNorm) {
                $normalizedMapping[$sourceNorm] = $targetNorm;
            }
        }

        // Transform fill attributes
        $elementsWithFill = $xpath->query('//*[@fill]');
        foreach ($elementsWithFill as $element) {
            $fill = $element->getAttribute('fill');
            if ($fill !== 'none' && !empty($fill)) {
                $normalized = $this->normalizeColor($fill);
                if ($normalized && isset($normalizedMapping[$normalized])) {
                    $element->setAttribute('fill', $normalizedMapping[$normalized]);
                }
            }
        }

        // Transform stroke attributes
        $elementsWithStroke = $xpath->query('//*[@stroke]');
        foreach ($elementsWithStroke as $element) {
            $stroke = $element->getAttribute('stroke');
            if ($stroke !== 'none' && !empty($stroke)) {
                $normalized = $this->normalizeColor($stroke);
                if ($normalized && isset($normalizedMapping[$normalized])) {
                    $element->setAttribute('stroke', $normalizedMapping[$normalized]);
                }
            }
        }

        // Transform style attributes
        $elementsWithStyle = $xpath->query('//*[@style]');
        foreach ($elementsWithStyle as $element) {
            $style = $element->getAttribute('style');
            $newStyle = $this->replaceColorsInStyle($style, $normalizedMapping);
            $element->setAttribute('style', $newStyle);
        }

        // Transform CSS in <style> tags
        $styleTags = $dom->getElementsByTagName('style');
        foreach ($styleTags as $styleTag) {
            $css = $styleTag->textContent;
            $newCss = $this->replaceColorsInCss($css, $normalizedMapping);
            $styleTag->textContent = $newCss;
        }
    }

    private function replaceColorsInStyle(string $style, array $colorMapping): string
    {
        return preg_replace_callback(
            '/(fill|stroke|color|background-color):\s*([^;]+);?/i',
            function ($matches) use ($colorMapping) {
                $property = $matches[1];
                $color = trim($matches[2]);
                if ($color !== 'none' && !empty($color)) {
                    $normalized = $this->normalizeColor($color);
                    if ($normalized && isset($colorMapping[$normalized])) {
                        return "{$property}: {$colorMapping[$normalized]};";
                    }
                }
                return $matches[0];
            },
            $style
        );
    }

    private function replaceColorsInCss(string $css, array $colorMapping): string
    {
        return preg_replace_callback(
            '/(fill|stroke|color|background-color):\s*([^;}]+)/i',
            function ($matches) use ($colorMapping) {
                $property = $matches[1];
                $color = trim($matches[2]);
                if ($color !== 'none' && !empty($color)) {
                    $normalized = $this->normalizeColor($color);
                    if ($normalized && isset($colorMapping[$normalized])) {
                        return "{$property}: {$colorMapping[$normalized]}";
                    }
                }
                return $matches[0];
            },
            $css
        );
    }

    public function sanitizeFromString(string $svgContent, ?string $colorScheme = null, array $colorMapping = []): array
    {
        // Create temp file
        $tempPath = sys_get_temp_dir() . '/svg_' . uniqid() . '.svg';
        file_put_contents($tempPath, $svgContent);

        try {
            $result = $this->sanitize($tempPath, $colorScheme, $colorMapping);
            unlink($tempPath);
            return $result;
        } catch (Exception $e) {
            if (file_exists($tempPath)) {
                unlink($tempPath);
            }
            throw $e;
        }
    }
}
