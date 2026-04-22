
export interface GitHubFile {
  name: string;
  path: string;
  type: 'file' | 'dir';
  sha: string;
  size: number;
  content?: string;
  download_url?: string;
}

export async function fetchRepoContents(repoPath: string, token?: string, path: string = ''): Promise<GitHubFile[]> {
  const [owner, repo] = repoPath.replace('https://github.com/', '').replace('.git', '').split('/');
  if (!owner || !repo) throw new Error('Caminho do repositório inválido. Use formato: dono/repositorio');

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
  };

  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || 'Erro ao buscar conteúdo do GitHub');
  }

  return response.json();
}

export async function fetchFileContent(repoPath: string, filePath: string, token?: string): Promise<{ content: string, sha: string }> {
  const [owner, repo] = repoPath.replace('https://github.com/', '').replace('.git', '').split('/');
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
  };

  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error('Erro ao buscar arquivo do GitHub');
  }

  const data = await response.json();
  // GitHub returns content encoded in base64 if it's a file
  const content = data.encoding === 'base64' 
    ? decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))))
    : data.content;

  return { content, sha: data.sha };
}

export async function updateFileContent(
  repoPath: string, 
  filePath: string, 
  content: string, 
  sha: string, 
  token: string,
  message: string = 'Update via Fluxion App'
): Promise<void> {
  const [owner, repo] = repoPath.replace('https://github.com/', '').replace('.git', '').split('/');
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
  
  // Encode content to base64 (handling unicode correctly)
  const b64Content = btoa(unescape(encodeURIComponent(content)));

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      content: b64Content,
      sha,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || 'Erro ao atualizar arquivo no GitHub');
  }
}
