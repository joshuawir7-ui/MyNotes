import { FileIcon } from "lucide-react";

export const FILE_TYPE_ICONS: Record<string, string> = {
  xlsx: '/icons/excel_3d.png',
  xls: '/icons/excel_3d.png',
  csv: '/icons/excel_3d.png',
  docx: '/icons/word.png',
  doc: '/icons/word.png',
  pdf: '/icons/pdf.png',
  pptx: '/icons/powerpoint.png',
  ppt: '/icons/powerpoint.png',
  mp3: '/icons/audio.png',
  wav: '/icons/audio.png',
  ogg: '/icons/audio.png',
  m4a: '/icons/audio.png',
  audio: '/icons/audio.png'
};

export function getFileIcon(fileType: string = '', fileName: string = '') {
    const ext = (fileType || fileName.split('.').pop() || '').toLowerCase();
    
    // Si tenemos un ícono exacto (como el PNG 3D de Excel), lo retornamos
    if (FILE_TYPE_ICONS[ext]) {
        return { 
            imageSrc: FILE_TYPE_ICONS[ext], 
            color: '', 
            bg: 'bg-transparent' 
        };
    }

    // Fallback genérico para otros tipos de archivos
    return { 
        Icon: FileIcon, 
        color: 'text-primary', 
        bg: 'bg-primary/20' 
    };
}
