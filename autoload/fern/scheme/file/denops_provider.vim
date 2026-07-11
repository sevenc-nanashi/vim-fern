let s:Promise = vital#fern#import('Async.Promise')

function! fern#scheme#file#denops_provider#new() abort
  return {
        \ 'get_root': funcref('fern#scheme#file#denops_provider#get_root'),
        \ 'get_parent': funcref('fern#scheme#file#denops_provider#get_parent'),
        \ 'get_children': funcref('fern#scheme#file#denops_provider#get_children'),
        \ '_denops': v:true,
        \}
endfunction

function! fern#scheme#file#denops_provider#get_root(uri) abort
  let fri = fern#fri#parse(a:uri)
  let path = fern#fri#to#filepath(fri)
  return s:node(fern#denops#request('root', {'path': path}))
endfunction

function! fern#scheme#file#denops_provider#get_parent(node, ...) abort
  return s:request('parent', {'path': a:node._path})
        \.then({ v -> s:node(v) })
endfunction

function! fern#scheme#file#denops_provider#get_children(node, ...) abort
  if a:node.status is# 0
    return s:Promise.reject(printf('no children exists for %s', a:node._path))
  endif
  return s:request('children', {'path': a:node._path})
        \.then({ vs -> map(vs, { _, v -> s:node(v) }) })
endfunction

function! s:request(operation, args) abort
  try
    return fern#denops#request_promise(a:operation, a:args)
  catch
    return s:Promise.reject(v:exception)
  endtry
endfunction

function! s:node(value) abort
  let path = a:value.path
  let name = a:value.name
  let status = a:value.status
  let bufname = status
        \ ? fern#fri#format(fern#fri#new({
        \     'scheme': 'fern',
        \     'path': fern#fri#format(fern#fri#from#filepath(path)),
        \   }))
        \ : path
  return {
        \ 'name': name,
        \ 'status': status,
        \ 'hidden': a:value.hidden,
        \ 'bufname': bufname,
        \ '_path': path,
        \}
endfunction
