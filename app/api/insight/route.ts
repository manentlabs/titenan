// app/api/insight/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    let prompt = "";

    if (body.type === "association") {
      prompt = buildAssociationPrompt(body.result);
    } else if (body.type === "prediction") {
      prompt = buildPredictionPrompt(body.result);
    } else if (body.classification_meta || body.result?.classLabels) {
      prompt = buildClassificationPrompt(body);
    } else if (body.result?.stats || body.result?.silhouette !== undefined) {
      prompt = buildClusteringPrompt(body);
    } else {
      prompt = `Kamu adalah data analyst senior. Berikan analisis menyeluruh dari hasil berikut:\n${JSON.stringify(body, null, 2)}`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "Kamu adalah data analyst senior yang berpengalaman menjelaskan hasil analisis data kepada berbagai kalangan — dari tim teknis hingga stakeholder bisnis. Tugasmu adalah memberikan insight yang menggabungkan evaluasi teknis model DAN kesimpulan nyata dari temuan data. Selalu gunakan bahasa Indonesia yang profesional namun mudah dipahami. Hindari jargon teknis berlebihan. Sertakan contoh kontekstual dan rekomendasi yang actionable.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1200,
      stream: true,
    });

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

/* ═══════════════════════════════════════════════════════════════
   CLUSTERING
═══════════════════════════════════════════════════════════════ */
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
        return `- Cluster ${c.id + 1}: ${c.count} data (${c.pct}%) → rata-rata fitur: ${means}`;
      })
      .join("\n");
  }

  const silhouetteQuality =
    parseFloat(silhouette) > 0.7
      ? "sangat baik"
      : parseFloat(silhouette) > 0.5
      ? "cukup baik"
      : parseFloat(silhouette) > 0.25
      ? "lemah"
      : "buruk";

  return `Kamu adalah data analyst senior. Analisis hasil clustering berikut secara menyeluruh.

═══════════════════════════════
DATA & MODEL
═══════════════════════════════
- Algoritma       : ${algo}
- Scaling         : ${scaling}
- Total data      : ${total} baris
- Jumlah cluster  : ${k}
- Fitur yang digunakan: ${columns?.join(", ") || "tidak tersedia"}

═══════════════════════════════
KUALITAS CLUSTERING
═══════════════════════════════
- Silhouette Score    : ${silhouette} (${silhouetteQuality} — semakin mendekati 1 semakin baik)
- Davies-Bouldin Index: ${daviesBouldin} (semakin kecil semakin baik)
- Inertia (WCSS)      : ${inertia} (semakin kecil cluster semakin padat)

═══════════════════════════════
PROFIL TIAP CLUSTER
═══════════════════════════════
${clusterDetails}

═══════════════════════════════
TUGAS KAMU
═══════════════════════════════
Tulis analisis dalam 5 bagian berikut:

**1. KESIMPULAN TEMUAN DATA**
Jelaskan karakteristik nyata tiap cluster berdasarkan nilai rata-rata fiturnya.
Beri nama atau label deskriptif untuk tiap cluster (contoh: "Cluster 1 = Pelanggan Premium").
Jelaskan apa yang membedakan satu cluster dari yang lain secara kontekstual.
Tulis seolah menjelaskan kepada manajer bisnis, bukan programmer.

**2. EVALUASI KUALITAS CLUSTERING**
Apakah silhouette score dan Davies-Bouldin menunjukkan pemisahan cluster yang baik?
Apakah jumlah cluster ${k} sudah optimal atau perlu disesuaikan?
Jelaskan dengan bahasa sederhana.

**3. CLUSTER YANG PERLU DIPERHATIKAN**
Cluster mana yang paling kecil atau paling besar?
Adakah cluster yang terlalu mirip satu sama lain?
Apa implikasinya terhadap interpretasi data?

**4. REKOMENDASI AKSI NYATA**
Berikan 2-3 rekomendasi konkret berdasarkan temuan cluster.
Fokus pada apa yang bisa dilakukan bisnis/pengguna dengan informasi ini.
Contoh: "Cluster 2 dengan nilai pembelian tinggi bisa dijadikan target program loyalitas..."

**5. KESIMPULAN AKHIR**
Satu paragraf ringkas: apa insight paling berharga dari clustering ini
dan langkah prioritas yang sebaiknya dilakukan selanjutnya.

Gunakan bahasa Indonesia profesional namun mudah dipahami orang awam.
Gunakan contoh kontekstual yang relevan dengan nama fitur yang ada.`;
}

/* ═══════════════════════════════════════════════════════════════
   KLASIFIKASI
═══════════════════════════════════════════════════════════════ */
function buildClassificationPrompt(body: any): string {
  const { result, columns, total, algo, classification_meta } = body;

  const f1 = result.f1?.toFixed(3) ?? "tidak tersedia";
  const precision = result.precision?.toFixed(3) ?? "tidak tersedia";
  const recall = result.recall?.toFixed(3) ?? "tidak tersedia";
  const trainAcc = (result.trainAccuracy * 100).toFixed(1);
  const testAcc = (result.testAccuracy * 100).toFixed(1);
  const overfit = ((result.trainAccuracy - result.testAccuracy) * 100).toFixed(1);
  const overfitStatus =
    parseFloat(overfit) > 15
      ? "⚠️ overfitting signifikan"
      : parseFloat(overfit) > 8
      ? "⚠️ potensi overfitting ringan"
      : "✓ stabil";

  const f1Quality =
    parseFloat(f1) > 0.9
      ? "sangat baik"
      : parseFloat(f1) > 0.8
      ? "baik"
      : parseFloat(f1) > 0.6
      ? "cukup"
      : "perlu perbaikan";

  let classDetails = "";
  if (result.stats && result.stats.length > 0) {
    classDetails = result.stats
      .map(
        (c: any) =>
          `- Kelas "${c.label}": ${c.count} data (${c.pct}%), akurasi kelas=${c.accuracy}%, benar=${c.correct} prediksi`
      )
      .join("\n");
  }

  let featureImportanceText = "";
  if (result.featureImportance) {
    const sorted = Object.entries(result.featureImportance).sort(
      (a: any, b: any) => b[1] - a[1]
    );
    featureImportanceText = `
═══════════════════════════════
KONTRIBUSI FITUR (FEATURE IMPORTANCE)
═══════════════════════════════
${sorted.map(([col, val]) => `- ${col}: ${val}%`).join("\n")}`;
  }

  let algoDetails = "";
  if (algo === "decision_tree") {
    algoDetails = `- Tree Depth Aktual : ${result.treeDepth ?? "?"}`;
  } else if (algo === "random_forest") {
    algoDetails = `- Jumlah Pohon      : ${result.numTrees ?? classification_meta?.numTrees ?? "?"}
- Tree Depth        : ${result.treeDepth ?? "?"}`;
  } else if (algo === "svm") {
    algoDetails = `- Support Vectors   : ${result.supportVectors ?? "?"}
- Regularisasi (C)  : ${classification_meta?.svmC ?? "?"}`;
  }

  const meta = classification_meta || {};

  return `Kamu adalah data analyst senior. Analisis hasil klasifikasi berikut secara menyeluruh.

═══════════════════════════════
DATA & MODEL
═══════════════════════════════
- Algoritma     : ${algo}
- Total data    : ${total} baris
- Kolom target  : ${meta.targetCol || "?"}
- Test split    : ${(meta.testRatio || 0.2) * 100}%
- Fitur         : ${columns?.join(", ") || "tidak tersedia"}
${algoDetails}

═══════════════════════════════
PERFORMA MODEL
═══════════════════════════════
- F1 Score      : ${f1} (${f1Quality})
- Precision     : ${precision}
- Recall        : ${recall}
- Akurasi Train : ${trainAcc}%
- Akurasi Test  : ${testAcc}%
- Selisih       : ${overfit}% — ${overfitStatus}

═══════════════════════════════
DISTRIBUSI & AKURASI PER KELAS
═══════════════════════════════
${classDetails}
${featureImportanceText}

═══════════════════════════════
TUGAS KAMU
═══════════════════════════════
Tulis analisis dalam 5 bagian berikut:

**1. KESIMPULAN TEMUAN DATA**
Jelaskan pola nyata yang ditemukan dalam data, bukan sekadar angka.
Kelas mana yang dominan? Apa yang membedakan tiap kelas secara kontekstual?
Jika ada feature importance, jelaskan fitur paling berpengaruh dan artinya dalam konteks nyata.
Tulis seolah menjelaskan kepada stakeholder bisnis, bukan programmer.

**2. EVALUASI PERFORMA MODEL**
Apakah F1 score, precision, dan recall menunjukkan model yang layak digunakan?
Bandingkan akurasi train vs test — adakah overfitting atau underfitting?
Jelaskan dampak praktisnya: misalnya precision rendah berarti banyak false alarm.

**3. KELAS YANG BERMASALAH**
Identifikasi kelas dengan akurasi terendah secara spesifik.
Mengapa kelas tersebut sulit diprediksi?
Apakah karena datanya sedikit (class imbalance) atau polanya tumpang tindih?

**4. REKOMENDASI AKSI NYATA**
Berikan 2-3 rekomendasi konkret — gabungkan saran teknis dan saran berbasis temuan data.
Contoh: "Karena fitur X paling berpengaruh, fokuskan pengumpulan data pada variabel ini..."
Jangan hanya bicara tuning model, tapi juga implikasi bisnis/keputusan nyata.

**5. KESIMPULAN AKHIR**
Satu paragraf ringkas: apa yang paling penting dari analisis ini
dan langkah prioritas yang sebaiknya dilakukan selanjutnya.

Gunakan bahasa Indonesia profesional namun mudah dipahami orang awam.
Gunakan contoh kontekstual yang relevan dengan nama fitur dan kelas yang ada.`;
}

/* ═══════════════════════════════════════════════════════════════
   ASSOCIATION RULES
═══════════════════════════════════════════════════════════════ */
function buildAssociationPrompt(data: any): string {
  const { num_rules, top_rules, params, num_transactions, algorithm } = data;

  const topRulesText = (top_rules || [])
    .slice(0, 7)
    .map((r: any, i: number) => {
      return `${i + 1}. [${r.antecedent.join(" + ")}] → [${r.consequent.join(" + ")}]
   support=${r.support.toFixed(3)}, confidence=${r.confidence.toFixed(3)}, lift=${r.lift.toFixed(2)}`;
    })
    .join("\n");

  const liftQuality =
    top_rules?.[0]?.lift > 3
      ? "sangat kuat"
      : top_rules?.[0]?.lift > 2
      ? "kuat"
      : top_rules?.[0]?.lift > 1.5
      ? "sedang"
      : "lemah";

  return `Kamu adalah data analyst senior. Analisis hasil association rule mining berikut secara menyeluruh.

═══════════════════════════════
DATA & MODEL
═══════════════════════════════
- Algoritma         : ${algorithm}
- Total transaksi   : ${num_transactions}
- Total rules       : ${num_rules}
- Min Support       : ${params?.minSupport}
- Min Confidence    : ${params?.minConfidence}
- Min Lift          : ${params?.minLift}

═══════════════════════════════
TOP RULES (BERDASARKAN LIFT TERTINGGI)
═══════════════════════════════
${topRulesText}

Kekuatan asosiasi terkuat: ${liftQuality} (lift=${top_rules?.[0]?.lift?.toFixed(2)})

═══════════════════════════════
TUGAS KAMU
═══════════════════════════════
Tulis analisis dalam 5 bagian berikut:

**1. KESIMPULAN TEMUAN DATA**
Jelaskan pola asosiasi yang paling menarik dan bermakna dari data transaksi ini.
Item atau kombinasi item apa yang paling sering muncul bersamaan?
Ceritakan narasi di balik angka — mengapa kombinasi ini masuk akal secara kontekstual?
Tulis seolah menjelaskan kepada manajer toko atau bisnis.

**2. INTERPRETASI METRIK UTAMA**
Jelaskan arti support, confidence, dan lift dari 2-3 aturan terkuat
dengan bahasa yang mudah dipahami (hindari definisi matematis).
Contoh: "Lift 3.2 berarti pelanggan yang membeli X, 3x lebih mungkin membeli Y dibanding rata-rata."

**3. POLA YANG PERLU DIPERHATIKAN**
Adakah aturan yang mengejutkan atau tidak terduga?
Adakah aturan dengan confidence tinggi tapi lift rendah (atau sebaliknya)?
Apa implikasinya terhadap interpretasi pola tersebut?

**4. REKOMENDASI AKSI NYATA**
Berikan 2-3 rekomendasi konkret berbasis temuan asosiasi ini.
Contoh: strategi penempatan produk, bundling, promosi silang, rekomendasi sistem.
Sebutkan rule spesifik yang mendasari setiap rekomendasi.

**5. KESIMPULAN AKHIR**
Satu paragraf ringkas: pola paling berharga dari analisis ini
dan langkah bisnis paling prioritas yang bisa segera diambil.

Gunakan bahasa Indonesia profesional namun mudah dipahami.
Sebutkan nama item/produk yang spesifik dari rules yang ada.`;
}

/* ═══════════════════════════════════════════════════════════════
   PREDIKSI / FORECASTING
═══════════════════════════════════════════════════════════════ */
function buildPredictionPrompt(data: any): string {
  const { model_type, metrics, num_samples, params } = data;

  const mae = metrics?.mae?.toFixed(4) ?? "?";
  const rmse = metrics?.rmse?.toFixed(4) ?? "?";
  const r2 = metrics?.r2?.toFixed(4) ?? "?";
  const mape = metrics?.mape?.toFixed(2) ?? null;

  const r2Quality =
    parseFloat(r2) > 0.9
      ? "sangat kuat"
      : parseFloat(r2) > 0.7
      ? "kuat"
      : parseFloat(r2) > 0.4
      ? "sedang"
      : "lemah";

  let modelContext = "";
  if (model_type === "regression") {
    modelContext = `Model: Regresi Linear
Fitur input : ${params?.features?.join(", ") || "?"}
Target      : ${params?.target || "?"}
R²=${r2} menunjukkan hubungan ${r2Quality} antara fitur dan target.`;
  } else if (model_type === "lstm") {
    modelContext = `Model: LSTM (Deep Learning)
Lookback    : ${params?.lookback} periode
Epochs      : ${params?.epochs}
Hidden units: ${params?.units ?? "?"}
RMSE=${rmse} adalah rata-rata error prediksi dalam satuan data asli.`;
  } else if (model_type === "timeseries") {
    modelContext = `Model: Holt-Winters (Time Series)
Seasonality : ${params?.seasonality}
Alpha (level): ${params?.alpha}
Beta (trend) : ${params?.beta}
Gamma (seasonal): ${params?.gamma}
Forecast horizon: ${params?.forecastHorizon} periode ke depan`;
  } else {
    modelContext = `Model: ${model_type}
Parameter: ${JSON.stringify(params, null, 2)}`;
  }

  return `Kamu adalah data analyst senior. Analisis hasil prediksi/forecasting berikut secara menyeluruh.

═══════════════════════════════
DATA & MODEL
═══════════════════════════════
${modelContext}
- Jumlah data test : ${num_samples} sampel

═══════════════════════════════
METRIK PERFORMA
═══════════════════════════════
- MAE  (Mean Absolute Error)       : ${mae}
- RMSE (Root Mean Square Error)    : ${rmse}
- R²   (Koefisien Determinasi)     : ${r2} (${r2Quality})
${mape ? `- MAPE (Mean Absolute Pct Error) : ${mape}%` : ""}

═══════════════════════════════
TUGAS KAMU
═══════════════════════════════
Tulis analisis dalam 5 bagian berikut:

**1. KESIMPULAN TEMUAN DATA**
Apa yang ditemukan dari pola data yang dipelajari model?
Apakah ada tren, musiman, atau pola tertentu yang terdeteksi?
Jelaskan dalam konteks nyata — misalnya "penjualan cenderung naik setiap kuartal 4"
bukan sekadar angka statistik.

**2. EVALUASI AKURASI MODEL**
Apakah MAE, RMSE, dan R² menunjukkan model yang layak digunakan?
Terjemahkan angka error ke konteks nyata — misalnya "rata-rata meleset ${mae} unit per prediksi."
Apakah tingkat error ini dapat diterima untuk keputusan bisnis?

**3. KETERBATASAN & RISIKO**
Kondisi atau situasi apa yang mungkin membuat prediksi model meleset jauh?
Apakah data yang digunakan sudah representatif?
Risiko apa yang perlu diwaspadai jika model ini digunakan untuk keputusan nyata?

**4. REKOMENDASI AKSI NYATA**
Berikan 2-3 rekomendasi konkret berbasis hasil prediksi ini.
Bukan hanya saran teknis, tapi juga implikasi keputusan bisnis.
Contoh: "Berdasarkan forecast, stok perlu ditingkatkan X% pada periode Y..."

**5. KESIMPULAN AKHIR**
Satu paragraf ringkas: seberapa andal model ini untuk digunakan,
apa yang paling perlu diperbaiki, dan keputusan apa yang bisa segera diambil.

Gunakan bahasa Indonesia profesional namun mudah dipahami orang awam.
Terjemahkan semua angka ke konteks yang bermakna, bukan sekadar laporan statistik.`;
}