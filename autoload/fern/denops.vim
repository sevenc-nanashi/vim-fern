let s:Promise = vital#fern#import('Async.Promise')

function! fern#denops#available() abort
  if !exists('*denops#plugin#wait') || !exists('*denops#request')
    return v:false
  endif
  try
    return denops#plugin#wait('fern') is# 0
  catch
    call fern#logger#debug('Denops backend is unavailable:', v:exception)
    return v:false
  endtry
endfunction

function! fern#denops#request(operation, args) abort
  if !fern#denops#available()
    throw 'fern: Denops backend is unavailable'
  endif
  return denops#request('fern', 'request', [extend({'operation': a:operation}, a:args)])
endfunction

function! fern#denops#request_promise(operation, args) abort
  return s:Promise.new({ resolve -> resolve(fern#denops#request(a:operation, a:args)) })
endfunction
