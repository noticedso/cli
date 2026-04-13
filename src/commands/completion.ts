export async function completionCommand(shell?: string): Promise<void> {
  const target = (shell ?? "bash").toLowerCase();

  switch (target) {
    case "bash":
      console.log(bashCompletion());
      break;
    case "zsh":
      console.log(zshCompletion());
      break;
    case "fish":
      console.log(fishCompletion());
      break;
    default:
      console.error(`Unknown shell: ${target}. Supported: bash, zsh, fish`);
      process.exit(1);
  }
}

function bashCompletion(): string {
  return `# noticed bash completion
# Add to ~/.bashrc: eval "$(noticed completion bash)"
_noticed_completions() {
  local cur prev commands
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  commands="search config mcp completion"

  case "\${COMP_WORDS[1]}" in
    search)
      COMPREPLY=( $(compgen -W "--limit --offset --source --sort --columns --paths --json --csv --quiet --verbose --no-color --help" -- "\${cur}") )
      case "\${prev}" in
        --source|-s) COMPREPLY=( $(compgen -W "github linkedin" -- "\${cur}") ) ;;
        --sort) COMPREPLY=( $(compgen -W "name:asc name:desc company:asc company:desc source:asc source:desc" -- "\${cur}") ) ;;
      esac
      return 0
      ;;
    config)
      COMPREPLY=( $(compgen -W "--set-url --set-key --show --help" -- "\${cur}") )
      return 0
      ;;
    mcp)
      COMPREPLY=( $(compgen -W "--log-level --help" -- "\${cur}") )
      case "\${prev}" in
        --log-level) COMPREPLY=( $(compgen -W "debug info warn error" -- "\${cur}") ) ;;
      esac
      return 0
      ;;
    completion)
      COMPREPLY=( $(compgen -W "bash zsh fish" -- "\${cur}") )
      return 0
      ;;
    *)
      COMPREPLY=( $(compgen -W "\${commands} --help --version" -- "\${cur}") )
      return 0
      ;;
  esac
}
complete -F _noticed_completions noticed`;
}

function zshCompletion(): string {
  return `# noticed zsh completion
# Add to ~/.zshrc: eval "$(noticed completion zsh)"
_noticed() {
  local -a commands
  commands=(
    'search:Search your developer network'
    'config:Show or set configuration'
    'mcp:Start MCP server for AI agents'
    'completion:Generate shell completion script'
  )

  _arguments -C \\
    '--api-url[Override API URL]:url:' \\
    '--api-key[Override API key]:key:' \\
    '-v[Display version]' \\
    '--version[Display version]' \\
    '--help[Show help]' \\
    '1:command:->cmds' \\
    '*::arg:->args'

  case "$state" in
    cmds)
      _describe 'command' commands
      ;;
    args)
      case "$words[1]" in
        search)
          _arguments \\
            '-l[Max results]:limit:' \\
            '--limit[Max results]:limit:' \\
            '-o[Pagination offset]:offset:' \\
            '--offset[Pagination offset]:offset:' \\
            '-s[Filter source]:source:(github linkedin)' \\
            '--source[Filter source]:source:(github linkedin)' \\
            '--sort[Sort results]:sort:(name\\:asc name\\:desc company\\:asc company\\:desc)' \\
            '-c[Display columns]:columns:' \\
            '--columns[Display columns]:columns:' \\
            '-p[Include connection paths]' \\
            '--paths[Include connection paths]' \\
            '-j[Output JSON]' \\
            '--json[Output JSON]' \\
            '--csv[Output CSV]' \\
            '-q[Quiet mode]' \\
            '--quiet[Quiet mode]' \\
            '--verbose[Show all columns]' \\
            '--no-color[Disable colors]'
          ;;
        config)
          _arguments \\
            '--set-url[Set API URL]:url:' \\
            '--set-key[Set API key]:key:' \\
            '--show[Show current config]'
          ;;
        mcp)
          _arguments \\
            '--log-level[Log level]:level:(debug info warn error)'
          ;;
        completion)
          _arguments '1:shell:(bash zsh fish)'
          ;;
      esac
      ;;
  esac
}
compdef _noticed noticed`;
}

function fishCompletion(): string {
  return `# noticed fish completion
# Save to: ~/.config/fish/completions/noticed.fish
complete -c noticed -n "__fish_use_subcommand" -a search -d "Search your developer network"
complete -c noticed -n "__fish_use_subcommand" -a config -d "Show or set configuration"
complete -c noticed -n "__fish_use_subcommand" -a mcp -d "Start MCP server"
complete -c noticed -n "__fish_use_subcommand" -a completion -d "Generate shell completions"
complete -c noticed -n "__fish_use_subcommand" -l api-url -d "Override API URL"
complete -c noticed -n "__fish_use_subcommand" -l api-key -d "Override API key"
complete -c noticed -n "__fish_use_subcommand" -s v -l version -d "Display version"

# search subcommand
complete -c noticed -n "__fish_seen_subcommand_from search" -s l -l limit -d "Max results"
complete -c noticed -n "__fish_seen_subcommand_from search" -s o -l offset -d "Pagination offset"
complete -c noticed -n "__fish_seen_subcommand_from search" -s s -l source -d "Filter source" -a "github linkedin"
complete -c noticed -n "__fish_seen_subcommand_from search" -l sort -d "Sort results" -a "name:asc name:desc company:asc company:desc"
complete -c noticed -n "__fish_seen_subcommand_from search" -s c -l columns -d "Columns to display"
complete -c noticed -n "__fish_seen_subcommand_from search" -s p -l paths -d "Include paths"
complete -c noticed -n "__fish_seen_subcommand_from search" -s j -l json -d "Output JSON"
complete -c noticed -n "__fish_seen_subcommand_from search" -l csv -d "Output CSV"
complete -c noticed -n "__fish_seen_subcommand_from search" -s q -l quiet -d "Quiet mode"
complete -c noticed -n "__fish_seen_subcommand_from search" -l verbose -d "Show all columns"
complete -c noticed -n "__fish_seen_subcommand_from search" -l no-color -d "Disable colors"

# config subcommand
complete -c noticed -n "__fish_seen_subcommand_from config" -l set-url -d "Set API URL"
complete -c noticed -n "__fish_seen_subcommand_from config" -l set-key -d "Set API key"
complete -c noticed -n "__fish_seen_subcommand_from config" -l show -d "Show config"

# mcp subcommand
complete -c noticed -n "__fish_seen_subcommand_from mcp" -l log-level -d "Log level" -a "debug info warn error"

# completion subcommand
complete -c noticed -n "__fish_seen_subcommand_from completion" -a "bash zsh fish"`;
}
