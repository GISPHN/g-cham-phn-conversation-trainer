export const PRIMARY_LOCAL_MODEL_ID =
  "gemma-2-2b-jpn-it-q4f16_1-MLC";
export const FALLBACK_LOCAL_MODEL_ID =
  "gemma-2-2b-jpn-it-q4f32_1-MLC";

export type LocalAIErrorCode =
  | "webgpu_unavailable"
  | "adapter_unavailable"
  | "shader_f16_unavailable"
  | "gpu_memory_or_device"
  | "model_download"
  | "initialization_failed";

export type WebGPUDiagnostics = {
  webgpuAvailable: boolean;
  adapterAvailable: boolean;
  shaderF16: boolean;
  adapterLabel?: string;
  selectedModelId?: string;
  fallbackUsed?: boolean;
};

export function selectLocalModelForDiagnostics(
  diagnostics: Pick<
    WebGPUDiagnostics,
    "webgpuAvailable" | "adapterAvailable" | "shaderF16"
  >
): string | null {
  if (!diagnostics.webgpuAvailable || !diagnostics.adapterAvailable) return null;
  return diagnostics.shaderF16
    ? PRIMARY_LOCAL_MODEL_ID
    : FALLBACK_LOCAL_MODEL_ID;
}

export function classifyLocalAIInitFailure(error: unknown): {
  code: LocalAIErrorCode;
  message: string;
} {
  const raw =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const text = raw.toLowerCase();

  if (
    /webgpu.*(?:not|unavailable|unsupported)|navigator\.gpu|webgpu_unavailable/.test(
      text
    )
  ) {
    return {
      code: "webgpu_unavailable",
      message:
        "このブラウザまたは端末ではWebGPUを利用できません。ChromeまたはEdgeの最新版と、WebGPU対応GPU/ドライバを確認してください。",
    };
  }

  if (/adapter.*(?:not found|unavailable|null)|adapter_unavailable/.test(text)) {
    return {
      code: "adapter_unavailable",
      message:
        "WebGPU APIはありますが、利用可能なGPUアダプタを取得できませんでした。GPUドライバやブラウザのハードウェアアクセラレーション設定を確認してください。",
    };
  }

  if (/shader[-_ ]?f16|required feature.*f16|f16.*(?:unsupported|not supported)/.test(text)) {
    return {
      code: "shader_f16_unavailable",
      message:
        "GPUがshader-f16に対応していません。互換性の高いq4f32モデルへの切替を試みます。",
    };
  }

  if (
    /out of memory|oom|device lost|device.*lost|gpu.*lost|allocation|allocate|insufficient.*memory|buffer.*(?:too large|size)|memory.*(?:limit|exceed)/.test(
      text
    )
  ) {
    return {
      code: "gpu_memory_or_device",
      message:
        "GPUメモリ不足またはGPU device lostが発生した可能性があります。ほかのGPU負荷の高いタブやアプリを閉じ、ブラウザを再起動して再試行してください。",
    };
  }

  if (
    /failed to fetch|networkerror|network error|http\s*(?:4|5)\d\d|fetch.*failed|download|huggingface|cdn/.test(
      text
    )
  ) {
    return {
      code: "model_download",
      message:
        "AIモデルの取得に失敗しました。通信環境、Hugging Faceへのアクセス、プロキシやセキュリティソフトの制限を確認してください。",
    };
  }

  return {
    code: "initialization_failed",
    message:
      "ローカルAIの初期化に失敗しました。ブラウザのWebGPU/GPUドライバ、GPUメモリ、通信環境のいずれかが原因の可能性があります。",
  };
}

export function formatWebGPUDiagnostics(
  diagnostics: WebGPUDiagnostics | null
): string {
  if (!diagnostics) return "診断情報なし";
  if (!diagnostics.webgpuAvailable) return "WebGPU: 非対応";
  if (!diagnostics.adapterAvailable) return "WebGPU: APIあり / GPUアダプタ取得不可";

  const parts = [
    "WebGPU: 対応",
    `shader-f16: ${diagnostics.shaderF16 ? "対応" : "非対応"}`,
  ];
  if (diagnostics.adapterLabel) {
    parts.push(`GPU: ${diagnostics.adapterLabel}`);
  }
  if (diagnostics.selectedModelId) {
    parts.push(`使用モデル: ${diagnostics.selectedModelId}`);
  }
  if (diagnostics.fallbackUsed) {
    parts.push("互換モデルへ自動切替");
  }
  return parts.join(" / ");
}
