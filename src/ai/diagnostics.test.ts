import { describe, expect, it } from "vitest";
import {
  FALLBACK_LOCAL_MODEL_ID,
  PRIMARY_LOCAL_MODEL_ID,
  classifyLocalAIInitFailure,
  formatWebGPUDiagnostics,
  selectLocalModelForDiagnostics,
} from "./diagnostics";

describe("local AI WebGPU diagnostics", () => {
  it("uses q4f16 when shader-f16 is available", () => {
    expect(
      selectLocalModelForDiagnostics({
        webgpuAvailable: true,
        adapterAvailable: true,
        shaderF16: true,
      })
    ).toBe(PRIMARY_LOCAL_MODEL_ID);
  });

  it("uses q4f32 when WebGPU works but shader-f16 is unavailable", () => {
    expect(
      selectLocalModelForDiagnostics({
        webgpuAvailable: true,
        adapterAvailable: true,
        shaderF16: false,
      })
    ).toBe(FALLBACK_LOCAL_MODEL_ID);
  });

  it("does not select a model without a GPU adapter", () => {
    expect(
      selectLocalModelForDiagnostics({
        webgpuAvailable: true,
        adapterAvailable: false,
        shaderF16: false,
      })
    ).toBeNull();
  });

  it("classifies GPU memory and device-lost errors", () => {
    expect(
      classifyLocalAIInitFailure(
        new Error("WebGPU device lost: out of memory while allocating buffer")
      ).code
    ).toBe("gpu_memory_or_device");
  });

  it("classifies model download failures", () => {
    expect(
      classifyLocalAIInitFailure(
        new Error("Failed to fetch model from huggingface CDN")
      ).code
    ).toBe("model_download");
  });

  it("classifies shader-f16 failures", () => {
    expect(
      classifyLocalAIInitFailure(
        new Error("Required feature shader-f16 is not supported")
      ).code
    ).toBe("shader_f16_unavailable");
  });

  it("includes the selected GPU adapter mode in diagnostics", () => {
    const text = formatWebGPUDiagnostics({
      webgpuAvailable: true,
      adapterAvailable: true,
      shaderF16: true,
      adapterMode: "default",
      selectedModelId: PRIMARY_LOCAL_MODEL_ID,
      fallbackUsed: false,
    });
    expect(text).toContain("GPU選択: default");
    expect(text).toContain("shader-f16: 対応");
  });

  it("formats the selected fallback model in diagnostics", () => {
    const text = formatWebGPUDiagnostics({
      webgpuAvailable: true,
      adapterAvailable: true,
      shaderF16: false,
      adapterLabel: "Intel GPU",
      selectedModelId: FALLBACK_LOCAL_MODEL_ID,
      fallbackUsed: true,
    });
    expect(text).toContain("shader-f16: 非対応");
    expect(text).toContain(FALLBACK_LOCAL_MODEL_ID);
    expect(text).toContain("自動切替");
  });
});
