import { useState, useEffect } from 'react';
import { Wand2, RefreshCw, Upload, X } from 'lucide-react';
import { FUNCTIONS_BASE, supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

const MODELS = [
  { value: 'nano-banana-pro', label: 'Nano Banana Pro' },
];

const ASPECT_RATIOS = [
  { value: '1:1', label: '1:1 (Square)' },
  { value: '16:9', label: '16:9 (Widescreen)' },
  { value: '21:9', label: '21:9 (Ultrawide)' },
  { value: '3:2', label: '3:2' },
  { value: '4:3', label: '4:3' },
  { value: '5:4', label: '5:4' },
  { value: '4:5', label: '4:5' },
  { value: '3:4', label: '3:4' },
  { value: '2:3', label: '2:3' },
  { value: '9:16', label: '9:16 (Portrait)' },
];

const RESOLUTIONS = [
  { value: '1K', label: '1K', credits: 0.1 },
  { value: '2K', label: '2K', credits: 0.15 },
  { value: '4K', label: '4K', credits: 0.3 },
];

const OUTPUT_FORMATS = ['png', 'jpeg', 'webp'];

interface Props {
  reusePrompt?: string;
  onReuseConsumed?: () => void;
}

export default function ImageGen({ reusePrompt, onReuseConsumed }: Props) {
  const { user } = useAuth();
  const [model, setModel] = useState('nano-banana-pro');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [resolution, setResolution] = useState('1K');
  const [outputFormat, setOutputFormat] = useState('png');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (reusePrompt !== undefined) {
      setPrompt(reusePrompt);
      onReuseConsumed?.();
    }
  }, [reusePrompt, onReuseConsumed]);

  const isImageToImage = uploadedImages.length > 0;
  const currentResolution = RESOLUTIONS.find(r => r.value === resolution);
  const estimatedCredits = currentResolution?.credits || 1;

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    setUploadedImages(prev => [...prev, ...files].slice(0, 14));
  }

  function removeImage(index: number) {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  }

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError('');

    try {
      const { data: historyItem, error: dbError } = await supabase
        .from('generation_history')
        .insert({
          type: 'image',
          prompt: prompt.trim(),
          status: 'pending',
          model,
          parameters: {
            aspect_ratio: aspectRatio,
            resolution,
            output_format: outputFormat,
            mode: isImageToImage ? 'image-to-image' : 'text-to-image',
          },
          cost: estimatedCredits,
          user_id: user?.id ?? null,
        })
        .select('id')
        .single();

      if (dbError || !historyItem) {
        setError('Failed to create history entry');
        setLoading(false);
        return;
      }

      const historyId = historyItem.id;

      const formData = new FormData();
      formData.append('prompt', prompt.trim());
      formData.append('aspect_ratio', aspectRatio === 'auto' ? '1:1' : aspectRatio);
      formData.append('resolution', resolution);
      formData.append('output_format', outputFormat);
      if (user?.id) formData.append('user_id', user.id);

      uploadedImages.forEach((file, index) => {
        formData.append(`image_${index}`, file);
      });

      const res = await fetch(`${FUNCTIONS_BASE}/freepik-generate-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        await supabase
          .from('generation_history')
          .update({ status: 'failed', error_message: data.error || 'Generation failed' })
          .eq('id', historyId);
        setError(data.error || 'Generation failed');
        setLoading(false);
        return;
      }

      const taskId = data.task_id;
      const keyId: string | undefined = data.key_id;
      const creditCost: number = data.credit_cost ?? estimatedCredits;

      if (!taskId) {
        await supabase
          .from('generation_history')
          .update({ status: 'failed', error_message: 'No task ID returned from API' })
          .eq('id', historyId);
        setError('No task ID returned from API');
        setLoading(false);
        return;
      }

      await supabase
        .from('generation_history')
        .update({
          status: 'processing',
          parameters: {
            aspect_ratio: aspectRatio,
            resolution,
            output_format: outputFormat,
            mode: isImageToImage ? 'image-to-image' : 'text-to-image',
            task_id: taskId,
          },
        })
        .eq('id', historyId);

      setPrompt('');
      setUploadedImages([]);
      setLoading(false);

      const maxAttempts = 360;
      let attempts = 0;

      const poll = async () => {
        if (attempts >= maxAttempts) {
          await supabase
            .from('generation_history')
            .update({ status: 'failed', error_message: 'Generation timed out after 30 minutes' })
            .eq('id', historyId);
          return;
        }
        attempts++;

        try {
          const pollRes = await fetch(`${FUNCTIONS_BASE}/freepik-poll-task`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ task_id: taskId, history_id: historyId, key_id: keyId, credit_cost: creditCost }),
          });

          const pollData = await pollRes.json();
          const status: string = pollData.status || 'IN_PROGRESS';

          if (status === 'COMPLETED' || status === 'FAILED') return;

          setTimeout(poll, 5000);
        } catch {
          setTimeout(poll, 5000);
        }
      };

      setTimeout(poll, 3000);
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      {/* Model */}
      <div>
        <label className="block text-white font-semibold text-xs mb-1.5 uppercase tracking-wide">Model</label>
        <select
          value={model}
          onChange={e => setModel(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
        >
          {MODELS.map(m => (
            <option key={m.value} value={m.value} className="bg-slate-900">{m.label}</option>
          ))}
        </select>
      </div>

      {/* Prompt */}
      <div>
        <label className="block text-white font-semibold text-xs mb-1.5 uppercase tracking-wide">Prompt</label>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder={isImageToImage ? 'Describe the changes you want...' : 'A futuristic cinematic scene, highly detailed...'}
          rows={4}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-600 text-xs focus:outline-none focus:border-cyan-500 resize-none"
        />
      </div>

      {/* Image Upload */}
      <div>
        <label className="block text-white font-semibold text-xs mb-1.5 uppercase tracking-wide">
          Upload Image {uploadedImages.length > 0 && `(${uploadedImages.length}/14)`}
        </label>
        <label className="flex flex-col items-center justify-center gap-2 w-full bg-slate-800 border-2 border-dashed border-slate-700 rounded-lg p-3 cursor-pointer hover:border-cyan-500 transition-colors">
          <Upload size={16} className="text-slate-500" />
          <span className="text-xs text-slate-400">Click to upload (max 14)</span>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleImageUpload}
            disabled={uploadedImages.length >= 14}
            className="hidden"
          />
        </label>
        {uploadedImages.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-2">
            {uploadedImages.map((file, idx) => (
              <div key={idx} className="relative group">
                <img
                  src={URL.createObjectURL(file)}
                  alt={`Upload ${idx}`}
                  className="w-full aspect-square object-cover rounded-lg bg-slate-700"
                />
                <button
                  onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} className="text-white" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mode indicator */}
      <div className="text-xs text-slate-400 bg-slate-800 rounded-lg p-2 text-center border border-slate-700">
        {isImageToImage ? 'Image-to-Image Mode' : 'Text-to-Image Mode'}
      </div>

      {/* Aspect Ratio */}
      <div>
        <label className="block text-white font-semibold text-xs mb-1.5 uppercase tracking-wide">Aspect Ratio</label>
        <select
          value={aspectRatio}
          onChange={e => setAspectRatio(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
        >
          {ASPECT_RATIOS.map(ar => (
            <option key={ar.value} value={ar.value} className="bg-slate-900">{ar.label}</option>
          ))}
        </select>
      </div>

      {/* Resolution */}
      <div>
        <label className="block text-white font-semibold text-xs mb-1.5 uppercase tracking-wide">Resolution</label>
        <div className="flex gap-2">
          {RESOLUTIONS.map(res => (
            <button
              key={res.value}
              onClick={() => setResolution(res.value)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all border ${
                resolution === res.value
                  ? 'bg-cyan-500 text-white border-cyan-500'
                  : 'bg-slate-800 text-slate-400 hover:text-white border-slate-700'
              }`}
            >
              <span className="block">{res.label}</span>
              <span className="block text-[10px] opacity-70">{res.credits} cr</span>
            </button>
          ))}
        </div>
      </div>

      {/* Output Format */}
      <div>
        <label className="block text-white font-semibold text-xs mb-1.5 uppercase tracking-wide">Output Format</label>
        <div className="flex gap-2">
          {OUTPUT_FORMATS.map(fmt => (
            <button
              key={fmt}
              onClick={() => setOutputFormat(fmt)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all border ${
                outputFormat === fmt
                  ? 'bg-cyan-500 text-white border-cyan-500'
                  : 'bg-slate-800 text-slate-400 hover:text-white border-slate-700'
              }`}
            >
              {fmt.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Estimated cost */}
      <div className="text-xs text-slate-400 bg-slate-800 rounded-lg p-2.5 border border-slate-700 flex justify-between items-center">
        <span>Estimated cost</span>
        <span className="text-cyan-400 font-semibold">{estimatedCredits} credit{estimatedCredits !== 1 ? 's' : ''}</span>
      </div>

      {/* Error */}
      {error && (
        <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">
          {error}
        </div>
      )}

      {/* Generate */}
      <button
        onClick={handleGenerate}
        disabled={loading || !prompt.trim()}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 text-white font-semibold py-3 rounded-xl transition-all text-sm active:scale-[0.98]"
      >
        {loading ? (
          <><RefreshCw size={14} className="animate-spin" />Generating...</>
        ) : (
          <><Wand2 size={14} />{isImageToImage ? 'Transform Image' : 'Generate Image'}</>
        )}
      </button>
    </div>
  );
}
