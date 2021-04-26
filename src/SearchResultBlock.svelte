<script>
    export let title
    export let icon
    export let url
</script>

<div class="col s12 m12 l12">
    <a href={"https://" + url} target="_blank">
        <div class="card hoverable grey lighten-5">
            <div class="card-content"><span class="card-title"><img src={"https://" + icon}> <span
                    class="title">{title}</span></span>
                <span class="grey-text">{url}</span>
            </div>
        </div>
    </a>
</div>

<style>
    .card {
        cursor: pointer;
    }

    img {
        width: 24px;
        vertical-align: middle;
    }

    .title {
        vertical-align: middle;
    }
</style>