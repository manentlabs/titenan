// app/api/insight/route.ts
import { NextRequest, NextResponse } from "next/server";

// Pastikan Anda sudah install openai: npm install openai
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. Identifikasi tipe analisis
    let prompt = "";
    let type = "unknown";

    // Cek tipe berdasarkan field yang ada
    if (body.type === "association") {
      type = "association";
      prompt = buildAssociationPrompt(body.result);
    } else if (body.type === "prediction") {
      type = "prediction";
      prompt = buildPredictionPrompt(body.result);
    } else if (body.classification_meta || body.result?.classLabels) {
      type = "classification";
      prompt = buildClassificationPrompt(body);
    } else if (body.result?.stats || body.result?.silhouette !== undefined) {
      type = "clustering";
      prompt = buildClusteringPrompt(body);
    } else {
      // Fallback: coba detect dari isi
      type = "unknown";
      prompt = "Berikan analisis singkat tentang hasil analisis data berikut: " + JSON.stringify(body, null, 2);
    }

    // 2. Panggil OpenAI / Claude (contoh pakai OpenAI)
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "Anda adalah ahli data science yang memberikan insight naratif dari hasil analisis clustering, klasifikasi, asosiasi, atau prediksi. Jawab dalam bahasa Indonesia dengan gaya profesional namun mudah dipahami. Sertakan rekomendasi actionable.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 800,
      stream: true, // streaming response
    });

    // 3. Stream response
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of completion) {
          const text = chunk.choices[0]?.delta?.content || "";
          if (text) {
            controller.enqueue(new TextEncoder().encode(text));
          }
        }
        controller.close();
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error: any) {
    console.error("OpenAI Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ========== PROMPT BUILDER UNTUK MASING-MASING TIPE ==========

function buildClusteringPrompt(body: any): string {
  const { result, columns, total, algo, scaling } = body;
  const k = result.k || result.stats?.length || 0;
  const silhouette = result.silhouette?.toFixed(3) ?? "tidak tersedia";
  const daviesBouldin = result.daviesBouldin?.toFixed(3) ?? "tidak tersedia";
  const inertia = result.inertia?.toFixed(2) ?? "tidak tersedia";

  let clusterDetails = "";
  if (result.stats && result.stats.length > 0) {
    clusterDetails = result.stats
      .map((c: any) => {
        const means = Object.entries(c.means || {})
          .map(([col, val]) => `${col}=${Number(val).toFixed(2)}`)
          .join(", ");
        return `- Cluster ${c.id + 1}: ${c.count} data (${c.pct}%) → rata-rata: ${means}`;
      })
      .join("\n");
  }

  return `Berikut adalah hasil analisis clustering:
- Algoritma: ${algo}
- Scaling: ${scaling}
- Jumlah data: ${total}
- Jumlah cluster: ${k}
- Silhouette score: ${silhouette} (semakin mendekati 1 semakin baik)
- Davies-Bouldin index: ${daviesBouldin}
- Inertia (WCSS): ${inertia}

Detail tiap cluster:
${clusterDetails}

Tolong berikan interpretasi:
1. Apakah jumlah cluster sudah optimal?
2. Seberapa baik pemisahan antar cluster?
3. Karakteristik masing-masing cluster berdasarkan nilai rata-rata fitur.
4. Rekomendasi untuk perbaikan (misal: ubah scaling, coba algoritma lain, atau sesuaikan parameter).
Jawab dalam 3-4 paragraf.`;
}

function buildClassificationPrompt(body: any): string {
  const { result, columns, total, algo, scaling, classification_meta } = body;
  const f1 = result.f1?.toFixed(3) ?? "tidak tersedia";
  const precision = result.precision?.toFixed(3) ?? "tidak tersedia";
  const recall = result.recall?.toFixed(3) ?? "tidak tersedia";
  const trainAcc = (result.trainAccuracy * 100).toFixed(1) ?? "tidak tersedia";
  const testAcc = (result.testAccuracy * 100).toFixed(1) ?? "tidak tersedia";

  let classDetails = "";
  if (result.stats && result.stats.length > 0) {
    classDetails = result.stats
      .map((c: any) => `- Kelas ${c.label}: jumlah=${c.count}, akurasi kelas=${c.accuracy}%`)
      .join("\n");
  }

  const meta = classification_meta || {};
  return `Hasil klasifikasi dengan algoritma ${algo}:
- Target kolom: ${meta.targetCol || "?"}
- Test split: ${(meta.testRatio || 0.2) * 100}%
- Parameter: ${JSON.stringify(meta)}
- Total data: ${total}
- F1 Score: ${f1}
- Precision: ${precision}
- Recall: ${recall}
- Akurasi Train: ${trainAcc}%
- Akurasi Test: ${testAcc}%

Detail per kelas:
${classDetails}

Interpretasikan:
1. Seberapa baik performa model secara keseluruhan (F1 score, precision, recall)?
2. Apakah terjadi overfitting? (bandingkan train vs test accuracy)
3. Kelas mana yang paling sulit diprediksi? Mengapa?
4. Saran perbaikan (feature engineering, hyperparameter tuning, algoritma lain).
Jawab dalam 3-4 paragraf.`;
}

function buildAssociationPrompt(data: any): string {
  const { num_rules, top_rules, params, num_transactions, algorithm } = data;
  const topRulesText = top_rules
    .slice(0, 5)
    .map((r: any, i: number) => {
      return `${i + 1}. ${r.antecedent.join(", ")} → ${r.consequent.join(", ")} (support=${r.support.toFixed(3)}, confidence=${r.confidence.toFixed(3)}, lift=${r.lift.toFixed(2)})`;
    })
    .join("\n");

  return `Hasil association rule mining dengan algoritma ${algorithm}:
- Jumlah transaksi: ${num_transactions}
- Parameter: minSupport=${params.minSupport}, minConfidence=${params.minConfidence}, minLift=${params.minLift}
- Total rules ditemukan: ${num_rules}

5 aturan teratas berdasarkan lift:
${topRulesText}

Tolong analisis:
1. Apakah aturan-aturan tersebut bermakna secara bisnis? (misal: produk apa yang sering dibeli bersamaan)
2. Interpretasi nilai support, confidence, dan lift untuk aturan paling kuat.
3. Rekomendasi strategi (misal: penempatan produk, bundling, promosi).
Jawab dalam 3 paragraf.`;
}

function buildPredictionPrompt(data: any): string {
  const { model_type, metrics, num_samples, params } = data;
  const mae = metrics.mae?.toFixed(4) ?? "?";
  const rmse = metrics.rmse?.toFixed(4) ?? "?";
  const r2 = metrics.r2?.toFixed(4) ?? "?";

  let interpretation = "";
  if (model_type === "regression") {
    interpretation = `Model regresi linear dengan fitur: ${params.features?.join(", ") || "?"}. R² = ${r2} menunjukkan ${
      parseFloat(r2) > 0.7 ? "hubungan yang kuat" : parseFloat(r2) > 0.4 ? "hubungan sedang" : "hubungan lemah"
    } antara fitur dan target.`;
  } else if (model_type === "lstm") {
    interpretation = `Model LSTM dengan lookback=${params.lookback}, epochs=${params.epochs}. RMSE = ${rmse} menunjukkan tingkat kesalahan prediksi. `;
  } else if (model_type === "timeseries") {
    interpretation = `Model Holt-Winters dengan seasonality=${params.seasonality}, alpha=${params.alpha}, beta=${params.beta}, gamma=${params.gamma}. Forecast horizon=${params.forecastHorizon}. `;
  }

  return `Hasil prediksi/forecasting dengan model ${model_type}:
- Jumlah sampel test: ${num_samples}
- MAE (Mean Absolute Error): ${mae}
- RMSE (Root Mean Square Error): ${rmse}
- R² (koefisien determinasi): ${r2}
- Parameter model: ${JSON.stringify(params)}

Interpretasi:
${interpretation}
Apakah model ini dapat digunakan untuk prediksi yang reliable? Berikan saran untuk meningkatkan akurasi (misal: tambah data, tuning hyperparameter, coba algoritma lain). Jawab dalam 2-3 paragraf.`;
}