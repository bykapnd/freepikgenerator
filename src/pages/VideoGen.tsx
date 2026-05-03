import { useState, useEffect, useRef } from 'react';
import { Wand2, RefreshCw, Upload, X, Volume2, VolumeX } from 'lucide-react';
import { FUNCTIONS_BASE, supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

const MODELS = [
  {
    value: 'kling-v2-6-motion-control-std',
    label: 'Kling v2.6 Standard',
    group: 'Kling v2.6 - Motion Control',
    mode: 'std',
    creditsPerSecond: 0.059,
  },
  {
    value: 'kling-v2-6-motion-control-pro',
    label: 'Kling v2.6 Pro',
    group: 'Kling v2.6 - Motion Control',
    mode: 'pro',
    creditsPerSecond: 0.118,
  },
  {
    value: 'kling-v3-motion-control-std',
    label: 'Kling v3.0 Standard',
    group: 'Kling v3.0 - Motion Control',
    mode: 'std',
    creditsPerSecond: 0.126,
  },
  {
    value: 'kling-v3-motion-control-pro',
    label: 'Kling v3.0 Pro',
    group: 'Kling v3.0 - Motion Control',
    mode: 'pro',
    creditsPerSecond: 0.168,
  },
];

const CHARACTER_ORIENTATIONS = [
  { value: 'video', label: 'Video', description: 'Matches reference video — better for complex motions (max 30s)' },
  { value: 'image', label: 'Image', description: 'Matches reference image — better for camera movements (max 10s)' },
];

interface Props {
  reusePrompt?: string;
  onReuseConsumed?: () => void;
}

export default function VideoGen({ reusePrompt, onReuseConsumed }: Props) {
  const { user } = useAuth();
  const [model, setModel] = useState('kling-v2-6-motion-control-std');
  const [prompt, setPrompt] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [characterOrientation, setCharacterOrientation] = useState<'video' | 'image'>('video');
  const [keepOriginalSound, setKeepOriginalSound] = useState(true);
  const [cfgScale, setCfgScale] = useState(0.5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const selectedModel = MODELS.find(m => m.value === model)!;

  useEffect(() => {
    if (reusePrompt !== undefined) {
      setPrompt(reusePrompt);
      onReuseConsumed?.();
    }
  }, [reusePrompt, onReuseConsumed]);

  async function uploadFileToStorage(file: File, bucket: string): Promise<string> {
    const ext = file.name.split('.').pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, { contentType: file.type });
    if (uploadError) throw new Error(uploadError.message);
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setUploadingImage(true);
    try {
      const url = await uploadFileToStorage(file, 'motion-control-inputs');
      setImageUrl(url);
    } catch (err) {
      setError(`Image upload failed: ${(err as Error).message}`);
      setImageFile(null);
    } finally {
      setUploadingImage(false);
    }
  }

  function getVideoDuration(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve(Math.ceil(video.duration));
      };
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        reject(new Error('Could not read video metadata'));
      };
      video.src = URL.createObjectURL(file);
    });
  }

  async function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoFile(file);
    setUploadingVideo(true);
    try {
      const duration = await getVideoDuration(file);
      setVideoDuration(duration);
      const url = await uploadFileToStorage(file, 'motion-control-inputs');
      setVideoUrl(url);
    } catch (err) {
      setError(`Video upload failed: ${(err as Error).message}`);
      setVideoFile(null);
      setVideoDuration(null);
    } finally {
      setUploadingVideo(false);
    }
  }

  function removeImage() {
    setImageFile(null);
    setImageUrl('');
    if (imageInputRef.current) imageInputRef.current.value = '';
  }

  function removeVideo() {
    setVideoFile(null);
    setVideoUrl('');
    setVideoDuration(null);
    if (videoInputRef.current) videoInputRef.current.value = '';
  }

  async function handleGenerate() {
    if (!imageUrl || !videoUrl) return;
    setLoading(true);
    setError('');

    try {
      const maxDuration = characterOrientation === 'image' ? 10 : 30;
      const duration = videoDuration ? Math.min(videoDuration, maxDuration) : maxDuration;
      const estimatedCost = parseFloat((selectedModel.creditsPerSecond * duration).toFixed(3));

      const { data: historyItem, error: dbError } = await supabase
        .from('generation_history')
        .insert({
          type: 'video',
          prompt: prompt.trim() || '(motion control)',
          status: 'pending',
          model,
          parameters: {
            character_orientation: characterOrientation,
            keep_original_sound: keepOriginalSound,
            cfg_scale: cfgScale,
            mode: selectedModel.mode,
          },
          cost: estimatedCost,
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

      const res = await fetch(`${FUNCTIONS_BASE}/freepik-generate-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          model,
          prompt: prompt.trim(),
          image_url: imageUrl,
          video_url: videoUrl,
          character_orientation: characterOrientation,
          keep_original_sound: keepOriginalSound,
          cfg_scale: cfgScale,
          history_id: historyId,
          user_id: user?.id || '',
        }),
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
      const creditsPerSecond: number = data.credits_per_second ?? selectedModel.creditsPerSecond;

      if (!taskId) {
        await supabase
          .from('generation_history')
          .update({ status: 'failed', error_message: 'No task ID returned from API' })
          .eq('id', historyId);
        setError('No task ID returned from API');
        setLoading(false);
        return;
      }

      const creditCost = parseFloat((creditsPerSecond * duration).toFixed(3));

      await supabase
        .from('generation_history')
        .update({
          status: 'processing',
          parameters: {
            character_orientation: characterOrientation,
            keep_original_sound: keepOriginalSound,
            cfg_scale: cfgScale,
            mode: selectedModel.mode,
            task_id: taskId,
            key_id: keyId,
            credit_cost: creditCost,
            duration,
          },
        })
        .eq('id', historyId);

      // Reset form
      setPrompt('');
      setLoading(false);

      // Poll for result (max 30 min)
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
            body: JSON.stringify({
              task_id: taskId,
              history_id: historyId,
              key_id: keyId,
              credit_cost: creditsPerSecond * duration,
              model,
            }),
          });

          const pollData = await pollRes.json();
          const pollStatus = String(pollData.status || 'IN_PROGRESS').toUpperCase();

          if (pollStatus === 'COMPLETED' || pollStatus === 'FAILED') return;

          setTimeout(poll, 5000);
        } catch {
          setTimeout(poll, 10000);
        }
      };

      setTimeout(poll, 5000);
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  const canGenerate = !!imageUrl && !!videoUrl && !uploadingImage && !uploadingVideo;

  return (
    <div className="p-4 space-y-4">
      {/* Model selector */}
      <div>
        <label className="block text-white font-semibold text-xs mb-1.5 uppercase tracking-wide">Model</label>
        <div className="space-y-1.5">
          {(['Kling v2.6 - Motion Control', 'Kling v3.0 - Motion Control'] as const).map(group => (
            <div key={group}>
              <p className="text-slate-500 text-[10px] font-medium uppercase tracking-wider mb-1 px-0.5">{group}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {MODELS.filter(m => m.group === group).map(m => (
                  <button
                    key={m.value}
                    onClick={() => setModel(m.value)}
                    className={`py-2 px-2 rounded-lg text-xs font-medium transition-all border text-left ${
                      model === m.value
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-slate-800 text-slate-400 hover:text-white border-slate-700'
                    }`}
                  >
                    <span className="block font-semibold">{m.mode === 'std' ? 'Standard' : 'Pro'}</span>
                    <span className="block text-[10px] opacity-70">{m.creditsPerSecond} cr/s</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Prompt */}
      <div>
        <label className="block text-white font-semibold text-xs mb-1.5 uppercase tracking-wide">
          Prompt <span className="text-slate-500 font-normal normal-case">(optional)</span>
        </label>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Describe how you want the motion applied..."
          rows={3}
          maxLength={2500}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-600 text-xs focus:outline-none focus:border-blue-500 resize-none"
        />
        {prompt.length > 2400 && (
          <p className="text-xs text-amber-400 mt-1">{2500 - prompt.length} characters remaining</p>
        )}
      </div>

      {/* Character Image Upload */}
      <div>
        <label className="block text-white font-semibold text-xs mb-1.5 uppercase tracking-wide">
          Character Image <span className="text-red-400">*</span>
        </label>
        {imageFile ? (
          <div className="relative rounded-lg overflow-hidden bg-slate-800 border border-slate-700">
            <img
              src={URL.createObjectURL(imageFile)}
              alt="Character"
              className="w-full h-28 object-cover"
            />
            {uploadingImage && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-2">
                <RefreshCw size={14} className="text-blue-400 animate-spin" />
                <span className="text-xs text-white">Uploading...</span>
              </div>
            )}
            {!uploadingImage && (
              <button
                onClick={removeImage}
                className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 rounded-full p-1 transition-colors"
              >
                <X size={12} className="text-white" />
              </button>
            )}
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center gap-2 w-full bg-slate-800 border-2 border-dashed border-slate-700 rounded-lg p-4 cursor-pointer hover:border-blue-500 transition-colors">
            <Upload size={16} className="text-slate-500" />
            <span className="text-xs text-slate-400">Upload character image</span>
            <span className="text-[10px] text-slate-600">JPG, PNG, WEBP · min 300×300 · max 10MB</span>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageSelect}
              className="hidden"
            />
          </label>
        )}
      </div>

      {/* Reference Video Upload */}
      <div>
        <label className="block text-white font-semibold text-xs mb-1.5 uppercase tracking-wide">
          Reference Video <span className="text-red-400">*</span>
        </label>
        {videoFile ? (
          <div className="relative rounded-lg overflow-hidden bg-slate-800 border border-slate-700">
            <video
              src={URL.createObjectURL(videoFile)}
              className="w-full h-28 object-cover"
              muted
            />
            {uploadingVideo && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-2">
                <RefreshCw size={14} className="text-blue-400 animate-spin" />
                <span className="text-xs text-white">Uploading...</span>
              </div>
            )}
            {!uploadingVideo && (
              <button
                onClick={removeVideo}
                className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 rounded-full p-1 transition-colors"
              >
                <X size={12} className="text-white" />
              </button>
            )}
            <div className="px-2 py-1.5 text-[10px] text-slate-400 bg-slate-900/80 flex justify-between items-center">
              <span className="truncate">{videoFile.name}</span>
              {videoDuration !== null && (
                <span className="text-blue-400 font-medium ml-2 shrink-0">{videoDuration}s</span>
              )}
            </div>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center gap-2 w-full bg-slate-800 border-2 border-dashed border-slate-700 rounded-lg p-4 cursor-pointer hover:border-blue-500 transition-colors">
            <Upload size={16} className="text-slate-500" />
            <span className="text-xs text-slate-400">Upload reference video</span>
            <span className="text-[10px] text-slate-600">MP4, MOV, WEBM · 3–30s · max 10MB</span>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/x-m4v"
              onChange={handleVideoSelect}
              className="hidden"
            />
          </label>
        )}
      </div>

      {/* Character Orientation */}
      <div>
        <label className="block text-white font-semibold text-xs mb-1.5 uppercase tracking-wide">Character Orientation</label>
        <div className="grid grid-cols-2 gap-2">
          {CHARACTER_ORIENTATIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setCharacterOrientation(opt.value as 'video' | 'image')}
              className={`py-2 px-3 rounded-lg text-left transition-all border ${
                characterOrientation === opt.value
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-slate-800 text-slate-400 hover:text-white border-slate-700'
              }`}
            >
              <span className="block text-xs font-semibold">{opt.label}</span>
              <span className="block text-[10px] opacity-70 leading-tight mt-0.5">{opt.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Keep Original Sound */}
      <div>
        <button
          onClick={() => setKeepOriginalSound(v => !v)}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all ${
            keepOriginalSound
              ? 'bg-blue-500/10 border-blue-500/50 text-blue-400'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            {keepOriginalSound ? <Volume2 size={14} /> : <VolumeX size={14} />}
            <span className="text-xs font-medium">Keep Original Sound</span>
          </div>
          <div className={`w-8 h-4 rounded-full transition-colors relative ${keepOriginalSound ? 'bg-blue-500' : 'bg-slate-700'}`}>
            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${keepOriginalSound ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
        </button>
      </div>

      {/* CFG Scale */}
      <div>
        <label className="block text-white font-semibold text-xs mb-1.5 uppercase tracking-wide flex justify-between">
          <span>CFG Scale</span>
          <span className="text-blue-400 font-mono">{cfgScale.toFixed(2)}</span>
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={cfgScale}
          onChange={e => setCfgScale(parseFloat(e.target.value))}
          className="w-full h-1.5 appearance-none bg-slate-700 rounded-full outline-none cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between text-[10px] text-slate-600 mt-1">
          <span>Flexible</span>
          <span>Strict</span>
        </div>
      </div>

      {/* Estimated cost */}
      {(() => {
        const maxDur = characterOrientation === 'image' ? 10 : 30;
        const dur = videoDuration ? Math.min(videoDuration, maxDur) : maxDur;
        const cost = selectedModel.creditsPerSecond * dur;
        return (
          <div className="text-xs text-slate-400 bg-slate-800 rounded-lg p-2.5 border border-slate-700 flex justify-between items-center">
            <span>
              Est. cost ({videoDuration ? `${dur}s` : `${maxDur}s max`})
            </span>
            <span className="text-blue-400 font-semibold">
              {cost.toFixed(3)} cr
            </span>
          </div>
        );
      })()}

      {/* Error */}
      {error && (
        <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">
          {error}
        </div>
      )}

      {/* Generate */}
      <button
        onClick={handleGenerate}
        disabled={loading || !canGenerate}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-400 hover:to-cyan-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 text-white font-semibold py-3 rounded-xl transition-all text-sm active:scale-[0.98]"
      >
        {loading ? (
          <><RefreshCw size={14} className="animate-spin" />Generating...</>
        ) : uploadingImage || uploadingVideo ? (
          <><RefreshCw size={14} className="animate-spin" />Uploading files...</>
        ) : (
          <><Wand2 size={14} />Generate Video</>
        )}
      </button>

      {!imageUrl && !videoUrl && (
        <p className="text-xs text-slate-600 text-center">Upload a character image and reference video to generate</p>
      )}
    </div>
  );
}
